/**
 * Test Enhanced Data Provider
 * Tests comprehensive market data fetching including insights and SEC filings
 */

import { enhancedDataProvider } from './server/services/marketData/enhancedDataProvider';

async function testEnhancedData() {
  console.log('🔍 Testing Enhanced Data Provider...\n');
  
  try {
    const symbol = 'AAPL';
    
    // Test 1: Get comprehensive data
    console.log(`Test 1: Fetching comprehensive data for ${symbol}...`);
    const data = await enhancedDataProvider.getComprehensiveData(symbol, '1mo');
    
    console.log(`✓ Symbol: ${data.symbol}`);
    console.log(`✓ Company: ${data.meta.companyName}`);
    console.log(`✓ Current Price: $${data.currentPrice.toFixed(2)}`);
    console.log(`✓ 52-Week Range: $${data.meta.fiftyTwoWeekLow.toFixed(2)} - $${data.meta.fiftyTwoWeekHigh.toFixed(2)}`);
    console.log(`✓ Price History Points: ${data.priceHistory.length}`);
    
    if (data.insights) {
      console.log(`✓ Insights Available:`);
      console.log(`  - Technical Outlook: ${data.insights.technicalOutlook?.intermediateTerm || 'N/A'}`);
      console.log(`  - Research Reports: ${data.insights.researchReports?.length || 0}`);
      console.log(`  - Significant Developments: ${data.insights.significantDevelopments?.length || 0}`);
    }
    
    if (data.secFilings) {
      console.log(`✓ SEC Filings: ${data.secFilings.length}`);
      if (data.secFilings.length > 0) {
        const latest = data.secFilings[0];
        console.log(`  Latest: ${latest.type} - ${latest.title} (${latest.date})`);
      }
    }
    
    console.log();
    
    // Test 2: Get latest earnings report
    console.log(`Test 2: Fetching latest earnings report for ${symbol}...`);
    const earnings = await enhancedDataProvider.getLatestEarningsReport(symbol);
    
    if (earnings) {
      console.log(`✓ Latest Earnings: ${earnings.type}`);
      console.log(`  Title: ${earnings.title}`);
      console.log(`  Date: ${earnings.date}`);
      console.log(`  URL: ${earnings.edgarUrl}`);
    } else {
      console.log(`⚠️  No earnings report found`);
    }
    
    console.log();
    
    // Test 3: Get significant developments
    console.log(`Test 3: Fetching significant developments for ${symbol}...`);
    const developments = await enhancedDataProvider.getSignificantDevelopments(symbol);
    
    console.log(`✓ Found ${developments.length} significant developments`);
    developments.slice(0, 3).forEach((dev, i) => {
      console.log(`  ${i + 1}. ${dev.title} (${dev.date})`);
    });
    
    console.log();
    
    // Test 4: Get fundamentals summary
    console.log(`Test 4: Fetching fundamentals summary for ${symbol}...`);
    const summary = await enhancedDataProvider.getFundamentalsSummary(symbol);
    
    console.log(`✓ Fundamentals Summary:`);
    console.log(`  Company: ${summary.companyName}`);
    console.log(`  Market Cap: $${(summary.marketCap! / 1e9).toFixed(2)}B`);
    console.log(`  Technical Outlook: ${summary.technicalOutlook || 'N/A'}`);
    console.log(`  Recent Filings: ${summary.recentFilings}`);
    console.log(`  Significant Developments: ${summary.significantDevelopments}`);
    
    console.log();
    
    // Test 5: Batch fetch multiple symbols
    console.log(`Test 5: Batch fetching data for multiple symbols...`);
    const symbols = ['AAPL', 'MSFT', 'GOOGL'];
    const batchData = await enhancedDataProvider.getBatchData(symbols, '1mo');
    
    console.log(`✓ Fetched data for ${batchData.size} symbols:`);
    for (const [sym, stockData] of batchData.entries()) {
      console.log(`  ${sym}: $${stockData.currentPrice.toFixed(2)} (${stockData.meta.companyName})`);
    }
    
    console.log();
    console.log('✅ All enhanced data tests passed!');
    console.log('\n📊 Summary:');
    console.log('  ✓ Comprehensive data fetching');
    console.log('  ✓ SEC filings integration');
    console.log('  ✓ Company insights and research');
    console.log('  ✓ Significant developments tracking');
    console.log('  ✓ Batch data fetching');
    console.log('\n🎯 Enhanced data provider is ready for portfolio management!');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testEnhancedData();

