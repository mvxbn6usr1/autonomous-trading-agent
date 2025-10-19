import axios from 'axios';

async function testYahooData() {
  const symbol = 'AAPL';
  const periods = ['1mo', '3mo', '6mo', '1y'];
  
  for (const period of periods) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${period}`;
      const response = await axios.get(url);
      const result = response.data.chart.result[0];
      const timestamps = result.timestamp || [];
      console.log(`${period}: ${timestamps.length} data points`);
    } catch (error: any) {
      console.error(`${period}: Error - ${error.message}`);
    }
  }
}

testYahooData();
