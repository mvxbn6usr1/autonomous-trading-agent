/**
 * Market Data Service - Modular Provider Architecture
 * Supports multiple data providers with easy switching
 */

import { IMarketDataProvider, MarketDataPoint, QuoteData, TechnicalIndicators, Period, Interval } from './types';
import { YahooFinanceProvider } from './yahooFinanceProvider';

export * from './types';

/**
 * Market Data Factory
 * Manages multiple providers and allows easy switching
 */
class MarketDataFactory {
  private providers: Map<string, IMarketDataProvider> = new Map();
  private activeProvider: string = 'yahoo';

  constructor() {
    // Register available providers
    this.registerProvider('yahoo', new YahooFinanceProvider());
    // Future providers can be added here:
    // this.registerProvider('alphavantage', new AlphaVantageProvider());
    // this.registerProvider('polygon', new PolygonProvider());
    // this.registerProvider('hyperliquid', new HyperliquidProvider());
  }

  /**
   * Register a new market data provider
   */
  registerProvider(name: string, provider: IMarketDataProvider): void {
    this.providers.set(name, provider);
    console.log(`[MarketData] Registered provider: ${provider.getName()}`);
  }

  /**
   * Set the active provider
   */
  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not found`);
    }
    this.activeProvider = name;
    console.log(`[MarketData] Switched to provider: ${name}`);
  }

  /**
   * Get the current active provider
   */
  getProvider(): IMarketDataProvider {
    const provider = this.providers.get(this.activeProvider);
    if (!provider) {
      throw new Error(`Active provider ${this.activeProvider} not found`);
    }
    return provider;
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
const marketDataFactory = new MarketDataFactory();

/**
 * Market Data Service
 * High-level API for market data operations
 */
export const MarketDataService = {
  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    return marketDataFactory.getProvider().getCurrentPrice(symbol);
  },

  /**
   * Get detailed quote data
   */
  async getQuote(symbol: string): Promise<QuoteData> {
    return marketDataFactory.getProvider().getQuote(symbol);
  },

  /**
   * Get historical price data
   */
  async getHistoricalData(
    symbol: string,
    period: Period = '1mo',
    interval: Interval = '1d'
  ): Promise<MarketDataPoint[]> {
    return marketDataFactory.getProvider().getHistoricalData(symbol, period, interval);
  },

  /**
   * Get historical data with technical indicators
   */
  async getDataWithIndicators(
    symbol: string,
    period: Period = '1mo',
    interval: Interval = '1d'
  ): Promise<{ data: MarketDataPoint[]; indicators: TechnicalIndicators }> {
    return marketDataFactory.getProvider().getDataWithIndicators(symbol, period, interval);
  },

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return marketDataFactory.getProvider().getName();
  },

  /**
   * Switch to a different provider
   */
  setProvider(name: string): void {
    marketDataFactory.setActiveProvider(name);
  },

  /**
   * Register a custom provider
   */
  registerProvider(name: string, provider: IMarketDataProvider): void {
    marketDataFactory.registerProvider(name, provider);
  },

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return marketDataFactory.getAvailableProviders();
  },
};

