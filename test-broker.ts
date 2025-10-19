/**
 * Test Broker Integration
 */

import { getBroker } from './server/services/brokers';

async function testBroker() {
  console.log('Testing Broker Integration...\n');
  
  try {
    const broker = getBroker();
    console.log(`✓ Broker initialized in ${broker.mode} mode\n`);
    
    // Test 1: Get account
    console.log('1. Testing account access...');
    const account = await broker.getAccount();
    console.log(`✓ Account ID: ${account.accountId}`);
    console.log(`  Portfolio Value: $${account.portfolioValue.toFixed(2)}`);
    console.log(`  Cash: $${account.cash.toFixed(2)}`);
    console.log(`  Buying Power: $${account.buyingPower.toFixed(2)}\n`);
    
    // Test 2: Get positions
    console.log('2. Testing positions...');
    const positions = await broker.getPositions();
    console.log(`✓ Found ${positions.length} positions\n`);
    
    // Test 3: Get quote
    console.log('3. Testing market data...');
    const quote = await broker.getQuote('AAPL');
    console.log(`✓ AAPL: $${quote.price} at ${quote.timestamp.toLocaleString()}\n`);
    
    // Test 4: Check market hours
    console.log('4. Testing market hours...');
    const isOpen = await broker.isMarketOpen();
    console.log(`✓ Market is ${isOpen ? 'OPEN' : 'CLOSED'}\n`);
    
    console.log('✅ All broker tests passed!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testBroker();
