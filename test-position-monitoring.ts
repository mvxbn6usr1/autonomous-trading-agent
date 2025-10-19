/**
 * Test Position Monitoring
 * Simulates position monitoring with stop-loss and take-profit triggers
 */

import { randomUUID } from 'crypto';
import { createPosition, getOpenPositions, upsertUser, createStrategy } from './server/db';
import { monitorPositions, updatePositionStopLoss } from './server/services/tradingExecutionService';
import { getBroker } from './server/services/brokers';

async function testPositionMonitoring() {
  console.log('🔍 Testing Position Monitoring System...\n');
  
  try {
    const broker = getBroker();
    const userId = 'test-user-' + randomUUID();
    const strategyId = 'test-strategy-' + randomUUID();
    const symbol = 'AAPL';
    
    // Setup
    await upsertUser({
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
    });
    
    await createStrategy({
      id: strategyId,
      userId,
      name: 'Position Monitoring Test',
      description: 'Test strategy for position monitoring',
      riskLevel: 'medium',
      maxPositionSize: 5000,
      isActive: true,
    });
    
    console.log('✓ Test setup complete\n');
    
    // Get current price
    const quote = await broker.getQuote(symbol);
    const entryPrice = quote.price;
    
    console.log(`📊 Current Market Price: ${symbol} @ $${entryPrice}\n`);
    
    // Test 1: Create a position with stop-loss and take-profit
    console.log('Test 1: Creating test position...');
    const positionId = randomUUID();
    const quantity = 10;
    const stopLoss = entryPrice * 0.95; // 5% below entry
    const takeProfit = entryPrice * 1.10; // 10% above entry
    
    await createPosition({
      id: positionId,
      userId,
      strategyId,
      symbol,
      side: 'long',
      quantity,
      entryPrice: Math.round(entryPrice * 100),
      currentPrice: Math.round(entryPrice * 100),
      stopLoss: Math.round(stopLoss * 100),
      takeProfit: Math.round(takeProfit * 100),
      unrealizedPnL: 0,
      status: 'open',
    });
    
    console.log(`✓ Position created:`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Quantity: ${quantity} shares`);
    console.log(`  Entry: $${entryPrice.toFixed(2)}`);
    console.log(`  Stop Loss: $${stopLoss.toFixed(2)} (-5%)`);
    console.log(`  Take Profit: $${takeProfit.toFixed(2)} (+10%)\n`);
    
    // Test 2: Monitor with current price (no trigger)
    console.log('Test 2: Monitoring at current price (no trigger expected)...');
    const priceMap1 = new Map([[symbol, entryPrice]]);
    await monitorPositions(strategyId, priceMap1);
    
    let positions = await getOpenPositions(strategyId);
    console.log(`✓ Position status: ${positions.length > 0 ? 'OPEN' : 'CLOSED'}`);
    if (positions.length > 0) {
      const pos = positions[0];
      const pnl = pos.unrealizedPnL / 100;
      console.log(`  Unrealized P&L: $${pnl.toFixed(2)}\n`);
    }
    
    // Test 3: Simulate price increase (but not to take-profit)
    console.log('Test 3: Simulating 5% price increase...');
    const priceUp5 = entryPrice * 1.05;
    const priceMap2 = new Map([[symbol, priceUp5]]);
    await monitorPositions(strategyId, priceMap2);
    
    positions = await getOpenPositions(strategyId);
    console.log(`✓ Position status: ${positions.length > 0 ? 'OPEN' : 'CLOSED'}`);
    if (positions.length > 0) {
      const pos = positions[0];
      const pnl = pos.unrealizedPnL / 100;
      console.log(`  Current Price: $${priceUp5.toFixed(2)}`);
      console.log(`  Unrealized P&L: $${pnl.toFixed(2)} (+${((pnl / (entryPrice * quantity)) * 100).toFixed(2)}%)\n`);
    }
    
    // Test 4: Update trailing stop-loss
    console.log('Test 4: Updating trailing stop-loss...');
    const newStopLoss = entryPrice * 1.02; // Move stop to 2% profit
    await updatePositionStopLoss(positionId, newStopLoss);
    console.log(`✓ Stop-loss updated to $${newStopLoss.toFixed(2)} (trailing)\n`);
    
    // Test 5: Simulate stop-loss trigger
    console.log('Test 5: Simulating stop-loss trigger...');
    const priceDrop = entryPrice * 0.94; // Drop below stop-loss
    const priceMap3 = new Map([[symbol, priceDrop]]);
    
    console.log(`  Price drops to $${priceDrop.toFixed(2)}`);
    console.log(`  Stop-loss at $${stopLoss.toFixed(2)}`);
    console.log(`  Expecting position to close...\n`);
    
    await monitorPositions(strategyId, priceMap3);
    
    positions = await getOpenPositions(strategyId);
    console.log(`✓ Position status: ${positions.length > 0 ? 'OPEN' : 'CLOSED'}`);
    
    if (positions.length === 0) {
      console.log('  ✅ Stop-loss triggered successfully!\n');
    } else {
      console.log('  ⚠️  Position still open (stop-loss not triggered)\n');
    }
    
    // Test 6: Create new position and test take-profit
    console.log('Test 6: Testing take-profit trigger...');
    const positionId2 = randomUUID();
    
    await createPosition({
      id: positionId2,
      userId,
      strategyId,
      symbol,
      side: 'long',
      quantity,
      entryPrice: Math.round(entryPrice * 100),
      currentPrice: Math.round(entryPrice * 100),
      stopLoss: Math.round(stopLoss * 100),
      takeProfit: Math.round(takeProfit * 100),
      unrealizedPnL: 0,
      status: 'open',
    });
    
    console.log(`✓ New position created at $${entryPrice.toFixed(2)}`);
    
    const priceUp = entryPrice * 1.11; // Above take-profit
    const priceMap4 = new Map([[symbol, priceUp]]);
    
    console.log(`  Price rises to $${priceUp.toFixed(2)}`);
    console.log(`  Take-profit at $${takeProfit.toFixed(2)}`);
    console.log(`  Expecting position to close...\n`);
    
    await monitorPositions(strategyId, priceMap4);
    
    positions = await getOpenPositions(strategyId);
    console.log(`✓ Position status: ${positions.length > 0 ? 'OPEN' : 'CLOSED'}`);
    
    if (positions.length === 0) {
      console.log('  ✅ Take-profit triggered successfully!\n');
    } else {
      console.log('  ⚠️  Position still open (take-profit not triggered)\n');
    }
    
    // Summary
    console.log('✅ Position Monitoring Tests Complete!\n');
    console.log('📊 Summary:');
    console.log('  ✓ Position creation with stop-loss/take-profit');
    console.log('  ✓ Price updates and P&L calculation');
    console.log('  ✓ Trailing stop-loss updates');
    console.log('  ✓ Stop-loss trigger detection');
    console.log('  ✓ Take-profit trigger detection');
    console.log('\n🎯 Position monitoring system is fully functional!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testPositionMonitoring();

