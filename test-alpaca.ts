/**
 * Test Alpaca Paper Trading API Connection
 */

import Alpaca from '@alpacahq/alpaca-trade-api';

async function testAlpacaConnection() {
  console.log('Testing Alpaca Paper Trading API...\n');
  
  const apiKey = process.env.ALPACA_PAPER_API_KEY;
  const apiSecret = process.env.ALPACA_PAPER_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.error('❌ API credentials not found!');
    console.error('Set ALPACA_PAPER_API_KEY and ALPACA_PAPER_API_SECRET');
    return;
  }
  
  console.log('✓ API credentials found');
  console.log(`Key: ${apiKey.substring(0, 10)}...`);
  
  const alpaca = new Alpaca({
    keyId: apiKey,
    secretKey: apiSecret,
    paper: true,
    baseUrl: 'https://paper-api.alpaca.markets',
    usePolygon: false,
  });
  
  try {
    // Test 1: Get account info
    console.log('\n1. Testing account access...');
    const account = await alpaca.getAccount();
    console.log('✓ Account connected!');
    console.log(`   Portfolio Value: $${account.portfolio_value}`);
    console.log(`   Cash: $${account.cash}`);
    console.log(`   Buying Power: $${account.buying_power}`);
    
    // Test 2: Get current positions
    console.log('\n2. Testing positions...');
    const positions = await alpaca.getPositions();
    console.log(`✓ Found ${positions.length} open positions`);
    if (positions.length > 0) {
      positions.forEach((pos: any) => {
        console.log(`   ${pos.symbol}: ${pos.qty} shares @ $${pos.avg_entry_price}`);
      });
    }
    
    // Test 3: Get a quote
    console.log('\n3. Testing market data...');
    const quote = await alpaca.getLatestTrade('AAPL');
    console.log(`✓ Latest AAPL trade: $${quote.Price} at ${new Date(quote.Timestamp).toLocaleString()}`);
    
    // Test 4: Check market hours
    console.log('\n4. Testing market hours...');
    const clock = await alpaca.getClock();
    console.log(`✓ Market is ${clock.is_open ? 'OPEN' : 'CLOSED'}`);
    console.log(`   Next open: ${clock.next_open}`);
    console.log(`   Next close: ${clock.next_close}`);
    
    console.log('\n✅ All tests passed! Alpaca Paper Trading API is working correctly.');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testAlpacaConnection();

