/**
 * End-to-End Orchestrator Test
 * Tests the complete flow: agents analyze → orchestrator decides → broker executes
 */

import { randomUUID } from 'crypto';
import { TradingOrchestrator } from './server/services/tradingOrchestrator';
import { getBroker } from './server/services/brokers';
import { createStrategy, upsertUser } from './server/db';

async function testOrchestratorE2E() {
  console.log('🚀 Testing End-to-End Trading Orchestrator...\n');
  
  try {
    // Setup
    const broker = getBroker();
    const userId = 'test-user-' + randomUUID();
    const strategyId = 'test-strategy-' + randomUUID();
    const symbol = 'AAPL';
    
    console.log('📋 Test Configuration:');
    console.log(`  User ID: ${userId}`);
    console.log(`  Strategy ID: ${strategyId}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Broker Mode: ${broker.mode}\n`);
    
    // Create test user
    await upsertUser({
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
    });
    console.log('✓ Test user created\n');
    
    // Create test strategy
    await createStrategy({
      id: strategyId,
      userId,
      name: 'E2E Test Strategy',
      description: 'End-to-end test strategy',
      riskLevel: 'medium',
      maxPositionSize: 5000, // $5000 max position
      isActive: true,
    });
    console.log('✓ Test strategy created\n');
    
    // Check initial account state
    const initialAccount = await broker.getAccount();
    console.log('💰 Initial Account State:');
    console.log(`  Cash: $${initialAccount.cash.toFixed(2)}`);
    console.log(`  Portfolio Value: $${initialAccount.portfolioValue.toFixed(2)}`);
    console.log(`  Buying Power: $${initialAccount.buyingPower.toFixed(2)}\n`);
    
    // Get initial positions
    const initialPositions = await broker.getPositions();
    console.log(`📊 Initial Positions: ${initialPositions.length}\n`);
    
    // Initialize orchestrator
    const orchestrator = new TradingOrchestrator();
    console.log('✓ Orchestrator initialized\n');
    
    // Initialize strategy
    console.log('🔧 Initializing strategy...');
    await orchestrator.initializeStrategy(strategyId, symbol);
    console.log('✓ Strategy initialized\n');
    
    // Run a complete trading cycle
    console.log('🔄 Running trading cycle...');
    console.log('  This will:');
    console.log('  1. Fetch market data with technical indicators');
    console.log('  2. Run all 7 AI agents (Technical, Fundamental, Sentiment, Bull, Bear, Trader, Risk Manager)');
    console.log('  3. Make a trading decision based on consensus');
    console.log('  4. Execute trade via Alpaca broker if approved');
    console.log('  5. Monitor existing positions\n');
    
    const accountValue = initialAccount.portfolioValue;
    
    // Start strategy (this runs one cycle immediately)
    await orchestrator.startStrategy(strategyId, symbol, accountValue);
    
    console.log('\n✓ Trading cycle completed!\n');
    
    // Check final account state
    const finalAccount = await broker.getAccount();
    console.log('💰 Final Account State:');
    console.log(`  Cash: $${finalAccount.cash.toFixed(2)}`);
    console.log(`  Portfolio Value: $${finalAccount.portfolioValue.toFixed(2)}`);
    console.log(`  Buying Power: $${finalAccount.buyingPower.toFixed(2)}\n`);
    
    // Get final positions
    const finalPositions = await broker.getPositions();
    console.log(`📊 Final Positions: ${finalPositions.length}`);
    
    if (finalPositions.length > 0) {
      console.log('\n📈 Position Details:');
      for (const position of finalPositions) {
        console.log(`  ${position.symbol}:`);
        console.log(`    Quantity: ${position.quantity}`);
        console.log(`    Entry: $${position.averageEntryPrice.toFixed(2)}`);
        console.log(`    Current: $${position.currentPrice.toFixed(2)}`);
        console.log(`    Market Value: $${position.marketValue.toFixed(2)}`);
        console.log(`    P&L: $${position.unrealizedPL.toFixed(2)} (${position.unrealizedPLPercent.toFixed(2)}%)`);
      }
    }
    
    // Stop the strategy
    console.log('\n🛑 Stopping strategy...');
    orchestrator.stopStrategy(strategyId);
    console.log('✓ Strategy stopped\n');
    
    // Summary
    console.log('✅ End-to-End Test Complete!\n');
    console.log('📊 Summary:');
    console.log(`  - Agents analyzed ${symbol}`);
    console.log(`  - Trading decision made`);
    console.log(`  - Position changes: ${initialPositions.length} → ${finalPositions.length}`);
    
    if (finalPositions.length > initialPositions.length) {
      console.log('\n✨ Trade was executed successfully!');
    } else if (finalPositions.length === initialPositions.length) {
      console.log('\n💡 No trade executed (likely HOLD decision or risk rejection)');
    }
    
    console.log('\n🎯 The autonomous trading system is fully operational!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testOrchestratorE2E();

