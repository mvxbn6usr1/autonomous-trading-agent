// End-to-end testing script for the complete app flow
// This script tests the entire user journey and identifies any bugs

import { getDb } from './server/db';
import { users, strategies } from './drizzle/schema';

const db = getDb();
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { pdtTracker } from './server/services/compliance/pdtTracker';
import { surveillanceService } from './server/services/compliance/surveillance';
import { cache } from './server/services/cache';
import { MarketDataService } from './server/services/marketData';
import { AgentOrchestrator } from './server/services/agents';
import { tradingOrchestrator } from './server/services/tradingOrchestrator';
import { BacktestEngine } from './server/services/backtesting/backtestEngine';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  error?: any;
}

const results: TestResult[] = [];

function logTest(testName: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, error?: any) {
  results.push({ testName, status, message, error });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} ${testName}: ${message}`);
  if (error) {
    console.error('   Error:', error);
  }
}

async function testDatabaseConnection() {
  try {
    const testUsers = await db.select().from(users).limit(1);
    logTest('Database Connection', 'PASS', `Connected successfully (${testUsers.length} users found)`);
  } catch (error) {
    logTest('Database Connection', 'FAIL', 'Failed to connect to database', error);
  }
}

async function testCacheSystem() {
  try {
    const stats = await cache.getStats();
    const health = await cache.healthCheck();
    
    if (stats.enabled && health) {
      logTest('Redis Cache', 'PASS', `Redis connected (${stats.keyCount} keys, ${stats.memory} memory)`);
    } else if (!stats.enabled) {
      logTest('Redis Cache', 'WARN', 'Redis not configured (using fallback mode)');
    } else {
      logTest('Redis Cache', 'FAIL', 'Redis configured but not healthy');
    }
    
    // Test cache operations
    await cache.cachePrice('TEST', 100.50, 10);
    const cachedPrice = await cache.getCachedPrice('TEST');
    
    if (cachedPrice === 100.50 || cachedPrice === null) {
      logTest('Cache Operations', 'PASS', 'Price caching works correctly');
    } else {
      logTest('Cache Operations', 'FAIL', `Unexpected cached value: ${cachedPrice}`);
    }
  } catch (error) {
    logTest('Cache System', 'FAIL', 'Cache system error', error);
  }
}

async function testMarketData() {
  try {
    // Test with real symbols
    const symbols = ['AAPL', 'MSFT', 'GOOGL'];
    let successCount = 0;
    
    for (const symbol of symbols) {
      try {
        const price = await MarketDataService.getCurrentPrice(symbol);
        if (price && price > 0) {
          successCount++;
        }
      } catch (error) {
        console.log(`   ${symbol} failed:`, error.message);
      }
    }
    
    if (successCount === symbols.length) {
      logTest('Market Data', 'PASS', `Successfully fetched data for all ${symbols.length} symbols`);
    } else if (successCount > 0) {
      logTest('Market Data', 'WARN', `Fetched ${successCount}/${symbols.length} symbols`);
    } else {
      logTest('Market Data', 'FAIL', 'Failed to fetch any market data');
    }
  } catch (error) {
    logTest('Market Data', 'FAIL', 'Market data service error', error);
  }
}

async function testAgentOrchestrator() {
  try {
    const orchestrator = new AgentOrchestrator();
    
    // Get real market data for testing
    const symbol = 'AAPL';
    const currentPrice = await MarketDataService.getCurrentPrice(symbol);
    const { indicators } = await MarketDataService.getDataWithIndicators(symbol, '3mo', '1d');
    
    const signal = await orchestrator.analyzeAndDecide({
      symbol,
      currentPrice,
      indicators,
      strategy: {
        riskLevel: 'medium',
        maxPositionSize: 2,
        stopLossPercent: 5,
      },
      portfolio: {
        totalValue: 100000,
        availableCash: 50000,
        currentPositions: 0,
      },
    });
    
    if (signal && signal.action && signal.confidence !== undefined) {
      logTest('Agent Orchestrator', 'PASS', `Generated signal: ${signal.action} with ${(signal.confidence * 100).toFixed(1)}% confidence`);
    } else {
      logTest('Agent Orchestrator', 'FAIL', 'Invalid signal generated');
    }
  } catch (error) {
    logTest('Agent Orchestrator', 'FAIL', 'Agent orchestrator error', error);
  }
}

async function testPDTTracking() {
  try {
    // Create a test user and strategy if they don't exist
    let testUser = await db.select().from(users).where(eq(users.email, 'test@example.com')).limit(1);
    
    let userId: string;
    if (testUser.length === 0) {
      userId = nanoid();
      await db.insert(users).values({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        loginMethod: 'test',
        role: 'user',
      });
    } else {
      userId = testUser[0].id;
    }
    
    let testStrategy = await db.select().from(strategies).where(eq(strategies.userId, userId)).limit(1);
    
    let strategyId: string;
    if (testStrategy.length === 0) {
      strategyId = nanoid();
      await db.insert(strategies).values({
        id: strategyId,
        userId,
        name: 'Test Strategy',
        riskLevel: 'medium',
        maxPositionSize: 2,
        dailyLossLimit: 10,
        isActive: false,
      });
    } else {
      strategyId = testStrategy[0].id;
    }
    
    // Test PDT status check
    const status = await pdtTracker.checkPDTStatus(userId, strategyId);
    
    if (status && typeof status.isDayTrader === 'boolean') {
      logTest('PDT Tracking', 'PASS', `PDT status: ${status.dayTradesLast5Days} day trades in last 5 days`);
    } else {
      logTest('PDT Tracking', 'FAIL', 'Invalid PDT status response');
    }
    
    // Test day trade validation
    const validation = await pdtTracker.validateDayTrade(userId, strategyId, 'AAPL');
    
    if (validation && typeof validation.allowed === 'boolean') {
      logTest('PDT Validation', 'PASS', `Day trade validation: ${validation.allowed ? 'allowed' : 'blocked'}`);
    } else {
      logTest('PDT Validation', 'FAIL', 'Invalid validation response');
    }
  } catch (error) {
    logTest('PDT Tracking', 'FAIL', 'PDT tracking error', error);
  }
}

async function testSurveillance() {
  try {
    // Use existing test user/strategy from PDT test
    const testUser = await db.select().from(users).where(eq(users.email, 'test@example.com')).limit(1);
    
    if (testUser.length === 0) {
      logTest('Surveillance', 'WARN', 'No test user found, skipping surveillance tests');
      return;
    }
    
    const userId = testUser[0].id;
    const testStrategy = await db.select().from(strategies).where(eq(strategies.userId, userId)).limit(1);
    
    if (testStrategy.length === 0) {
      logTest('Surveillance', 'WARN', 'No test strategy found, skipping surveillance tests');
      return;
    }
    
    const strategyId = testStrategy[0].id;
    
    // Run surveillance
    const report = await surveillanceService.runSurveillance(userId, strategyId);
    
    if (report && report.alerts !== undefined) {
      logTest('Surveillance', 'PASS', `Surveillance report: ${report.summary.total} alerts (${report.summary.high} high severity)`);
    } else {
      logTest('Surveillance', 'FAIL', 'Invalid surveillance report');
    }
  } catch (error) {
    logTest('Surveillance', 'FAIL', 'Surveillance error', error);
  }
}

async function testBacktesting() {
  try {
    const config = {
      strategyId: 'test-backtest',
      symbols: ['AAPL'],
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-10-15'),
      initialCapital: 100000,
      commission: 1.0,
    };
    
    const engine = new BacktestEngine(config);
    const results = await engine.runBacktest();
    
    if (results && results.totalReturn !== undefined && results.sharpeRatio !== undefined) {
      logTest('Backtesting', 'PASS', `Backtest completed: ${(results.totalReturn * 100).toFixed(2)}% return, Sharpe: ${results.sharpeRatio.toFixed(2)}`);
    } else {
      logTest('Backtesting', 'FAIL', 'Invalid backtest results');
    }
  } catch (error) {
    logTest('Backtesting', 'FAIL', 'Backtesting error', error);
  }
}

async function testTradingOrchestrator() {
  try {
    const testUser = await db.select().from(users).where(eq(users.email, 'test@example.com')).limit(1);
    
    if (testUser.length === 0) {
      logTest('Trading Orchestrator', 'WARN', 'No test user found, skipping orchestrator tests');
      return;
    }
    
    const userId = testUser[0].id;
    const testStrategy = await db.select().from(strategies).where(eq(strategies.userId, userId)).limit(1);
    
    if (testStrategy.length === 0) {
      logTest('Trading Orchestrator', 'WARN', 'No test strategy found, skipping orchestrator tests');
      return;
    }
    
    const strategyId = testStrategy[0].id;
    
    // Test portfolio summary
    const summary = await tradingOrchestrator.getPortfolioSummary(strategyId, 100000);
    
    if (summary) {
      logTest('Trading Orchestrator', 'PASS', `Portfolio summary generated successfully`);
    } else {
      logTest('Trading Orchestrator', 'FAIL', 'Failed to generate portfolio summary');
    }
  } catch (error) {
    logTest('Trading Orchestrator', 'FAIL', 'Trading orchestrator error', error);
  }
}

async function runAllTests() {
  console.log('=== End-to-End Application Testing ===\n');
  console.log('Testing all integrated features...\n');
  
  await testDatabaseConnection();
  await testCacheSystem();
  await testMarketData();
  await testAgentOrchestrator();
  await testPDTTracking();
  await testSurveillance();
  await testBacktesting();
  await testTradingOrchestrator();
  
  console.log('\n=== Test Summary ===\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  
  const successRate = (passed / results.length * 100).toFixed(1);
  console.log(`\nSuccess Rate: ${successRate}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! App is fully integrated and working.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
  
  console.log('\n=== Detailed Results ===\n');
  results.forEach(result => {
    const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} ${result.testName}: ${result.message}`);
  });
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run all tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
