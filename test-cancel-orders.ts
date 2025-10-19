/**
 * Cancel Pending Orders
 * Cleans up any pending orders in the Alpaca account
 */

import axios from 'axios';

const ALPACA_API_KEY = process.env.ALPACA_PAPER_API_KEY || 'PKQ79RTHZO5KBYH8Z6BG';
const ALPACA_SECRET_KEY = process.env.ALPACA_PAPER_SECRET_KEY || 'KYt6fRlrTycSqffQzirRbatrnPjUyF1o9kSp3jLz';
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets';

async function cancelAllOrders() {
  console.log('🧹 Checking for pending orders...\n');
  
  try {
    // Get all orders
    const response = await axios.get(`${ALPACA_BASE_URL}/v2/orders`, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
      },
    });
    
    const orders = response.data;
    console.log(`Found ${orders.length} orders\n`);
    
    if (orders.length === 0) {
      console.log('✓ No pending orders to cancel\n');
      return;
    }
    
    // Display orders
    for (const order of orders) {
      console.log(`Order ${order.id}:`);
      console.log(`  Symbol: ${order.symbol}`);
      console.log(`  Side: ${order.side}`);
      console.log(`  Qty: ${order.qty}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Created: ${order.created_at}`);
      console.log();
    }
    
    // Cancel all orders
    console.log('Cancelling all orders...\n');
    const cancelResponse = await axios.delete(`${ALPACA_BASE_URL}/v2/orders`, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
      },
    });
    
    console.log('✅ All orders cancelled successfully!\n');
    
    // Verify
    const verifyResponse = await axios.get(`${ALPACA_BASE_URL}/v2/orders`, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
      },
    });
    
    console.log(`Remaining orders: ${verifyResponse.data.length}\n`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

cancelAllOrders();

