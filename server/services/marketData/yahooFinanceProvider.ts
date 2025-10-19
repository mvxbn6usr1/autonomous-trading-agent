/**
 * Yahoo Finance Market Data Provider
 * Uses direct API calls for reliable market data access
 */

import axios from 'axios';
import type {
  IMarketDataProvider,
  MarketDataPoint,
  QuoteData,
  TechnicalIndicators,
  Period,
  Interval,
} from './types';

export class YahooFinanceProvider implements IMarketDataProvider {
  name = 'Yahoo Finance';
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance';

  getName(): string {
    return this.name;
  }

  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    const quote = await this.getQuote(symbol);
    return quote.price;
  }

  /**
   * Get quote data
   */
  async getQuote(symbol: string): Promise<QuoteData> {
    try {
      const url = `${this.baseUrl}/chart/${symbol}?interval=1d&range=1d`;
      const response = await axios.get(url);

      const data = response.data;
      if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error(`No quote data available for ${symbol}`);
      }

      const result = data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators.quote[0];

      return {
        symbol: meta.symbol,
        price: meta.regularMarketPrice || meta.previousClose || 0,
        change: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
        changePercent: ((meta.regularMarketPrice || 0) - (meta.previousClose || 0)) / (meta.previousClose || 1) * 100,
        volume: quote.volume[quote.volume.length - 1] || 0,
        marketCap: 0, // Not available in chart API
        high: meta.regularMarketDayHigh || 0,
        low: meta.regularMarketDayLow || 0,
        open: meta.regularMarketDayLow || 0,
        previousClose: meta.previousClose || 0,
      };
    } catch (error: any) {
      console.error(`[YahooFinance] Error fetching quote for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch quote for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Get historical data
   */
  async getHistoricalData(
    symbol: string,
    period: Period = '1mo',
    interval: Interval = '1d'
  ): Promise<MarketDataPoint[]> {
    try {
      const url = `${this.baseUrl}/chart/${symbol}?interval=${interval}&range=${period}`;
      const response = await axios.get(url);

      const data = response.data;
      if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error(`No historical data available for ${symbol}`);
      }

      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];

      const historicalData: MarketDataPoint[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        // Skip null values
        if (quote.close[i] === null) continue;

        historicalData.push({
          timestamp: new Date(timestamps[i] * 1000), // Convert to Date
          open: quote.open[i] || quote.close[i],
          high: quote.high[i] || quote.close[i],
          low: quote.low[i] || quote.close[i],
          close: quote.close[i],
          volume: quote.volume[i] || 0,
        });
      }

      return historicalData;
    } catch (error: any) {
      console.error(`[YahooFinance] Error fetching historical data for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch historical data for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Get historical data with technical indicators
   */
  async getDataWithIndicators(
    symbol: string,
    period: Period = '1mo',
    interval: Interval = '1d'
  ): Promise<{ data: MarketDataPoint[]; indicators: TechnicalIndicators }> {
    const data = await this.getHistoricalData(symbol, period, interval);
    const indicators = this.calculateIndicators(data);
    return { data, indicators };
  }

  /**
   * Calculate technical indicators from historical data
   */
  private calculateIndicators(data: MarketDataPoint[]): TechnicalIndicators {
    if (data.length < 50) {
      throw new Error('Insufficient data for technical indicators (need at least 50 data points)');
    }

    const closes = data.map(d => d.close);

    return {
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      bollingerBands: this.calculateBollingerBands(closes, 20, 2),
      sma20: this.calculateSMA(closes, 20),
      sma50: this.calculateSMA(closes, 50),
      ema12: this.calculateEMA(closes, 12),
      ema26: this.calculateEMA(closes, 26),
      atr: this.calculateATR(data, 14),
    };
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter(c => c > 0);
    const losses = recentChanges.filter(c => c < 0).map(Math.abs);

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return Math.round(rsi * 100) / 100;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(prices: number[]): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // For signal line, we'd need to calculate EMA of MACD values
    // Simplified: use 9-period approximation
    const signal = macd * 0.9; // Simplified signal line
    const histogram = macd - signal;

    return {
      macd: Math.round(macd * 100) / 100,
      signal: Math.round(signal * 100) / 100,
      histogram: Math.round(histogram * 100) / 100,
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);

    const squaredDiffs = recentPrices.map(price => Math.pow(price - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: Math.round((sma + stdDev * standardDeviation) * 100) / 100,
      middle: sma,
      lower: Math.round((sma - stdDev * standardDeviation) * 100) / 100,
    };
  }

  /**
   * Calculate SMA (Simple Moving Average)
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((a, b) => a + b, 0);
    return Math.round((sum / period) * 100) / 100;
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return Math.round(ema * 100) / 100;
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(data: MarketDataPoint[], period: number = 14): number {
    if (data.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((a, b) => a + b, 0) / period;
    return Math.round(atr * 100) / 100;
  }
}

