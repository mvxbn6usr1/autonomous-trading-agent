/**
 * Test Trading Execution Service
 * Tests the complete flow: broker order placement → database updates → position management
 */

import { randomUUID } from 'crypto';
import { getBroker } from './server/services/brokers';
import { executeBuyOrder, executeSellOrder, monitorPositions } from './server/services/tradingExecutionService';
import { TradeSignal } from './server/services/agents';
import { PositionSizeCalculation } from './server/services/riskManagement';

async function testTradingExecution() {
  console.log('Testing Trading Execution Service...\n');
  
  try {
    const broker = getBroker();
    console.log(`✓ Using broker in ${broker.mode} mode\n`);
    
    // Check account
    const account = await broker.getAccount();
    console.log(`Account Balance: $${account.cash.toFixed(2)}`);
    console.log(`Buying Power: $${account.buyingPower.toFixed(2)}\n`);
    
    // Check market status
    const isOpen = await broker.isMarketOpen();
    console.log(`Market Status: ${isOpen ? 'OPEN' : 'CLOSED'}`);
    
    if (!isOpen) {
      console.log('\n⚠️  Market is closed. Orders will be queued until market opens.');
      console.log('Note: In paper trading mode, this is expected behavior.\n');
    }
    
    // Get current price
    const symbol = 'AAPL';
    const quote = await broker.getQuote(symbol);
    console.log(`\nCurrent Price: ${symbol} @ $${quote.price}\n`);
    
    // Create a mock signal
    const signal: TradeSignal = {
      symbol,
      action: 'buy',
      confidence: 0.75,
      reasoning: 'Test buy order',
      agentReports: {} as any,
    };
    
    // Calculate position size (buy 10 shares for testing)
    const positionSize: PositionSizeCalculation = {
      quantity: 10,
      dollarAmount: quote.price * 10,
      stopLoss: quote.price * 0.95, // 5% stop loss
      takeProfit: quote.price * 1.10, // 10% take profit
      riskAmount: quote.price * 10 * 0.05,
      riskPercent: 5,
    };
    
    console.log('Position Details:');
    console.log(`  Quantity: ${positionSize.quantity} shares`);
    console.log(`  Total Cost: $${positionSize.dollarAmount.toFixed(2)}`);
    console.log(`  Stop Loss: $${positionSize.stopLoss.toFixed(2)}`);
    console.log(`  Take Profit: $${positionSize.takeProfit.toFixed(2)}`);
    console.log(`  Risk Amount: $${positionSize.riskAmount.toFixed(2)}\n`);
    
    // Test 1: Place a buy order
    console.log('Test 1: Placing BUY order...');
    const strategyId = 'test-strategy-' + randomUUID();
    const userId = 'test-user-' + randomUUID();
    
    const buyResult = await executeBuyOrder(
      signal,
      strategyId,
      userId,
      quote.price,
      positionSize
    );
    
    console.log(`✓ ${buyResult.message}`);
    console.log(`  Order ID: ${buyResult.orderId}`);
    console.log(`  Status: ${buyResult.status}`);
    if (buyResult.positionId) {
      console.log(`  Position ID: ${buyResult.positionId}`);
    }
    console.log();
    
    // Test 2: Check broker positions
    console.log('Test 2: Checking broker positions...');
    const brokerPositions = await broker.getPositions();
    console.log(`✓ Found ${brokerPositions.length} positions in broker`);
    
    if (brokerPositions.length > 0) {
      const position = brokerPositions[0];
      console.log(`  Symbol: ${position.symbol}`);
      console.log(`  Quantity: ${position.quantity}`);
      console.log(`  Entry: $${position.averageEntryPrice.toFixed(2)}`);
      console.log(`  Current: $${position.currentPrice.toFixed(2)}`);
      console.log(`  P&L: $${position.unrealizedPL.toFixed(2)} (${position.unrealizedPLPercent.toFixed(2)}%)`);
    }
    console.log();
    
    // Test 3: Monitor positions (check stop-loss/take-profit)
    console.log('Test 3: Testing position monitoring...');
    const priceMap = new Map([[symbol, quote.price]]);
    await monitorPositions(strategyId, priceMap);
    console.log('✓ Position monitoring completed\n');
    
    // Test 4: Get updated broker positions
    console.log('Test 4: Final position check...');
    const finalPositions = await broker.getPositions();
    console.log(`✓ Final position count: ${finalPositions.length}\n`);
    
    console.log('✅ All trading execution tests completed!');
    console.log('\n📊 Summary:');
    console.log(`  - Broker Mode: ${broker.mode}`);
    console.log(`  - Orders Placed: 1 BUY`);
    console.log(`  - Order Status: ${buyResult.status}`);
    console.log(`  - Positions: ${finalPositions.length}`);
    
    if (buyResult.status === 'filled') {
      console.log('\n✨ Trade execution is working perfectly!');
    } else {
      console.log('\n⏳ Order is pending (market closed or queued)');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testTradingExecution();

