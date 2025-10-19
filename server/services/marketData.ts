import { randomUUID } from "crypto";
import { insertMarketData, getLatestMarketData, getMarketDataRange } from "../db";
import { InsertMarketData, MarketData } from "../../drizzle/schema";

/**
 * Market Data Service
 * Handles real-time and historical market data with technical indicators
 */

export interface TechnicalIndicators {
  rsi: number; // Relative Strength Index (0-100)
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
  sma20: number; // Simple Moving Average 20
  sma50: number; // Simple Moving Average 50
  ema12: number; // Exponential Moving Average 12
  ema26: number; // Exponential Moving Average 26
  atr: number; // Average True Range
  volume: number;
}

export interface MarketDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Generate simulated market data for demonstration
 * In production, this would connect to real market data APIs
 */
export function generateSimulatedMarketData(
  symbol: string,
  basePrice: number = 10000,
  volatility: number = 0.02
): MarketDataPoint {
  const now = new Date();
  const change = (Math.random() - 0.5) * 2 * volatility;
  const open = basePrice;
  const close = basePrice * (1 + change);
  const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
  const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
  const volume = Math.floor(1000000 + Math.random() * 5000000);

  return {
    timestamp: now,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Store market data in database
 */
export async function storeMarketData(
  symbol: string,
  data: MarketDataPoint,
  interval: string = "1m"
): Promise<void> {
  const marketDataRecord: InsertMarketData = {
    id: randomUUID(),
    symbol,
    timestamp: data.timestamp,
    open: Math.round(data.open * 100), // Store as cents
    high: Math.round(data.high * 100),
    low: Math.round(data.low * 100),
    close: Math.round(data.close * 100),
    volume: data.volume,
    interval,
  };

  await insertMarketData(marketDataRecord);
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Default neutral

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate SMA (Simple Moving Average)
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;

  const slice = prices.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / period;
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;

  // Calculate signal line (9-period EMA of MACD)
  const macdValues = [];
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const e12 = calculateEMA(slice, 12);
    const e26 = calculateEMA(slice, 26);
    macdValues.push(e12 - e26);
  }

  const signal = calculateEMA(macdValues, 9);
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number } {
  const middle = calculateSMA(prices, period);

  if (prices.length < period) {
    return { upper: middle, middle, lower: middle };
  }

  const slice = prices.slice(-period);
  const squaredDiffs = slice.map((price) => Math.pow(price - middle, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
  const standardDeviation = Math.sqrt(variance);

  return {
    upper: middle + standardDeviation * stdDev,
    middle,
    lower: middle - standardDeviation * stdDev,
  };
}

/**
 * Calculate ATR (Average True Range)
 */
export function calculateATR(data: MarketDataPoint[], period: number = 14): number {
  if (data.length < 2) return 0;

  const trueRanges = [];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  return calculateSMA(trueRanges, Math.min(period, trueRanges.length));
}

/**
 * Calculate all technical indicators for a symbol
 */
export async function calculateTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
  // Get historical data (last 100 candles for indicator calculation)
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 100 * 60 * 1000); // 100 minutes ago

  const historicalData = await getMarketDataRange(symbol, startTime, endTime, "1m");

  if (historicalData.length < 20) {
    // Not enough data, return neutral indicators
    const latestData = await getLatestMarketData(symbol);
    const currentPrice = latestData ? latestData.close / 100 : 10000;

    return {
      rsi: 50,
      macd: { macd: 0, signal: 0, histogram: 0 },
      bollingerBands: { upper: currentPrice * 1.02, middle: currentPrice, lower: currentPrice * 0.98 },
      sma20: currentPrice,
      sma50: currentPrice,
      ema12: currentPrice,
      ema26: currentPrice,
      atr: currentPrice * 0.01,
      volume: 1000000,
    };
  }

  const closePrices = historicalData.map((d) => d.close / 100);
  const dataPoints: MarketDataPoint[] = historicalData.map((d) => ({
    timestamp: d.timestamp,
    open: d.open / 100,
    high: d.high / 100,
    low: d.low / 100,
    close: d.close / 100,
    volume: d.volume,
  }));

  const rsi = calculateRSI(closePrices);
  const macd = calculateMACD(closePrices);
  const bollingerBands = calculateBollingerBands(closePrices);
  const sma20 = calculateSMA(closePrices, 20);
  const sma50 = calculateSMA(closePrices, 50);
  const ema12 = calculateEMA(closePrices, 12);
  const ema26 = calculateEMA(closePrices, 26);
  const atr = calculateATR(dataPoints);
  const volume = dataPoints[dataPoints.length - 1]?.volume || 0;

  return {
    rsi,
    macd,
    bollingerBands,
    sma20,
    sma50,
    ema12,
    ema26,
    atr,
    volume,
  };
}

/**
 * Get current market price for a symbol
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
  const latest = await getLatestMarketData(symbol);
  if (latest) {
    return latest.close / 100;
  }

  // If no data exists, return a default price
  return 10000;
}

/**
 * Initialize market data stream for a symbol
 * In production, this would connect to WebSocket feeds
 */
export async function initializeMarketDataStream(symbol: string, basePrice: number = 10000): Promise<void> {
  // Generate initial historical data
  let currentPrice = basePrice;

  for (let i = 0; i < 100; i++) {
    const data = generateSimulatedMarketData(symbol, currentPrice, 0.02);
    await storeMarketData(symbol, data, "1m");
    currentPrice = data.close;

    // Small delay to spread out timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Update market data (simulated real-time updates)
 */
export async function updateMarketData(symbol: string): Promise<MarketDataPoint> {
  const latest = await getLatestMarketData(symbol);
  const basePrice = latest ? latest.close / 100 : 10000;

  const data = generateSimulatedMarketData(symbol, basePrice, 0.02);
  await storeMarketData(symbol, data, "1m");

  return data;
}

