/**
 * Test script to verify the complete agent system works
 */

import { MarketDataService } from './server/services/marketData/index';
import { AgentOrchestrator } from './server/services/agents';

async function testAgentSystem() {
  console.log('='.repeat(80));
  console.log('TESTING AUTONOMOUS TRADING AGENT SYSTEM');
  console.log('='.repeat(80));

  const symbol = 'AAPL';
  console.log(`\nTesting with symbol: ${symbol}\n`);

  try {
    // Step 1: Get market data
    console.log('Step 1: Fetching market data from Yahoo Finance...');
    const currentPrice = await MarketDataService.getCurrentPrice(symbol);
    console.log(`✓ Current price: $${currentPrice}`);

    const { data, indicators } = await MarketDataService.getDataWithIndicators(symbol, '3mo', '1d');
    console.log(`✓ Historical data points: ${data.length}`);
    console.log(`✓ Technical indicators:`);
    console.log(`  - RSI: ${indicators.rsi}`);
    console.log(`  - MACD: ${indicators.macd.macd} (Signal: ${indicators.macd.signal})`);
    console.log(`  - Bollinger Bands: ${indicators.bollingerBands.lower} - ${indicators.bollingerBands.upper}`);
    console.log(`  - SMA20: ${indicators.sma20}, SMA50: ${indicators.sma50}`);
    console.log(`  - ATR: ${indicators.atr}`);

    // Step 2: Run agent orchestration
    console.log('\nStep 2: Running multi-agent analysis...');
    const orchestrator = new AgentOrchestrator();

    const context = {
      symbol,
      currentPrice,
      indicators,
      strategy: {
        riskLevel: 'medium',
        maxPositionSize: 5,
        stopLossPercent: 5,
      },
      portfolio: {
        totalValue: 100000,
        availableCash: 50000,
        currentPositions: 0,
      },
    };

    const signal = await orchestrator.analyzeAndDecide(context);

    // Step 3: Display results
    console.log('\n' + '='.repeat(80));
    console.log('AGENT ANALYSIS RESULTS');
    console.log('='.repeat(80));

    console.log('\n📊 TECHNICAL ANALYST:');
    console.log(`  Recommendation: ${signal.agentReports.technical.recommendation.toUpperCase()}`);
    console.log(`  Confidence: ${(signal.agentReports.technical.confidence * 100).toFixed(1)}%`);
    console.log(`  Reasoning: ${signal.agentReports.technical.reasoning}`);
    console.log(`  Key Points:`);
    signal.agentReports.technical.keyPoints.forEach(point => console.log(`    - ${point}`));

    console.log('\n📈 FUNDAMENTAL ANALYST:');
    console.log(`  Recommendation: ${signal.agentReports.fundamental.recommendation.toUpperCase()}`);
    console.log(`  Confidence: ${(signal.agentReports.fundamental.confidence * 100).toFixed(1)}%`);
    console.log(`  Valuation: ${signal.agentReports.fundamental.valuation}`);
    console.log(`  Reasoning: ${signal.agentReports.fundamental.reasoning}`);

    console.log('\n😊 SENTIMENT ANALYST:');
    console.log(`  Recommendation: ${signal.agentReports.sentiment.recommendation.toUpperCase()}`);
    console.log(`  Confidence: ${(signal.agentReports.sentiment.confidence * 100).toFixed(1)}%`);
    console.log(`  Sentiment: ${signal.agentReports.sentiment.sentiment} (score: ${signal.agentReports.sentiment.score})`);
    console.log(`  Reasoning: ${signal.agentReports.sentiment.reasoning}`);

    console.log('\n🐂 BULL RESEARCHER:');
    console.log(`  Strength: ${(signal.agentReports.bull.strength * 100).toFixed(1)}%`);
    console.log(`  Arguments:`);
    signal.agentReports.bull.arguments.forEach(arg => console.log(`    - ${arg}`));
    console.log(`  Conclusion: ${signal.agentReports.bull.conclusion}`);

    console.log('\n🐻 BEAR RESEARCHER:');
    console.log(`  Strength: ${(signal.agentReports.bear.strength * 100).toFixed(1)}%`);
    console.log(`  Arguments:`);
    signal.agentReports.bear.arguments.forEach(arg => console.log(`    - ${arg}`));
    console.log(`  Conclusion: ${signal.agentReports.bear.conclusion}`);

    console.log('\n💼 TRADER AGENT:');
    console.log(`  Action: ${signal.agentReports.trader.action.toUpperCase()}`);
    console.log(`  Confidence: ${(signal.agentReports.trader.confidence * 100).toFixed(1)}%`);
    console.log(`  Synthesis: ${signal.agentReports.trader.synthesis}`);
    console.log(`  Risk Assessment: ${signal.agentReports.trader.riskAssessment}`);
    if (signal.agentReports.trader.targetPrice) {
      console.log(`  Target Price: $${signal.agentReports.trader.targetPrice}`);
    }
    if (signal.agentReports.trader.stopLoss) {
      console.log(`  Stop Loss: $${signal.agentReports.trader.stopLoss}`);
    }

    console.log('\n🛡️ RISK MANAGER:');
    console.log(`  Decision: ${signal.agentReports.riskManager.approved ? '✅ APPROVED' : '❌ VETOED'}`);
    console.log(`  Risk Score: ${(signal.agentReports.riskManager.riskScore * 100).toFixed(1)}%`);
    console.log(`  Reasoning: ${signal.agentReports.riskManager.reasoning}`);
    if (signal.agentReports.riskManager.violations.length > 0) {
      console.log(`  Violations:`);
      signal.agentReports.riskManager.violations.forEach(v => console.log(`    - ${v}`));
    }
    if (signal.agentReports.riskManager.warnings.length > 0) {
      console.log(`  Warnings:`);
      signal.agentReports.riskManager.warnings.forEach(w => console.log(`    - ${w}`));
    }

    console.log('\n' + '='.repeat(80));
    console.log('FINAL DECISION');
    console.log('='.repeat(80));
    console.log(`\n🎯 Action: ${signal.action.toUpperCase()}`);
    console.log(`📊 Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    console.log(`💭 Reasoning: ${signal.reasoning}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testAgentSystem().then(() => {
  console.log('\nExiting...');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

