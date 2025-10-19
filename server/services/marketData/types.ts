/**
 * Market Data Provider Interface
 * Defines the contract for all market data sources
 */

export interface MarketDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  atr: number; // Average True Range for volatility
}

export interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface IMarketDataProvider {
  /**
   * Get current price for a symbol
   */
  getCurrentPrice(symbol: string): Promise<number>;

  /**
   * Get detailed quote data
   */
  getQuote(symbol: string): Promise<QuoteData>;

  /**
   * Get historical price data
   */
  getHistoricalData(symbol: string, period: Period, interval: Interval): Promise<MarketDataPoint[]>;

  /**
   * Get historical data with technical indicators
   */
  getDataWithIndicators(symbol: string, period: Period, interval: Interval): Promise<{ data: MarketDataPoint[]; indicators: TechnicalIndicators }>;



  /**
   * Get provider name
   */
  getName(): string;
}

export type Period = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max";
export type Interval = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1wk" | "1mo";

