/**
 * Enhanced Market Data Provider
 * Provides comprehensive market data including news, insights, SEC filings, and fundamentals
 */

import { callDataApi } from '../../_core/dataApi';

export interface StockInsights {
  symbol: string;
  companyName?: string;
  technicalOutlook?: {
    shortTerm?: string;
    intermediateTerm?: string;
    longTerm?: string;
  };
  companyMetrics?: {
    innovativeness?: number;
    sustainability?: number;
    hiring?: number;
  };
  valuation?: any;
  researchReports?: Array<{
    title: string;
    provider: string;
    summary?: string;
  }>;
  significantDevelopments?: Array<{
    title: string;
    date: string;
    description?: string;
  }>;
}

export interface SECFiling {
  title: string;
  type: string; // 10-K, 10-Q, 8-K, etc.
  date: string;
  edgarUrl: string;
  maxAge?: number;
}

export interface ComprehensiveStockData {
  symbol: string;
  currentPrice: number;
  priceHistory: Array<{
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  insights?: StockInsights;
  secFilings?: SECFiling[];
  meta: {
    companyName?: string;
    exchange: string;
    currency: string;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    marketCap?: number;
  };
}

export class EnhancedDataProvider {
  /**
   * Get comprehensive stock data including price, insights, and filings
   */
  async getComprehensiveData(symbol: string, range: string = '3mo'): Promise<ComprehensiveStockData> {
    console.log(`[EnhancedData] Fetching comprehensive data for ${symbol}`);

    // Fetch chart data
    const chartData = await this.getChartData(symbol, range);
    
    // Fetch insights in parallel
    const [insights, secFilings] = await Promise.all([
      this.getInsights(symbol).catch(err => {
        console.warn(`[EnhancedData] Failed to fetch insights for ${symbol}:`, err.message);
        return undefined;
      }),
      this.getSECFilings(symbol).catch(err => {
        console.warn(`[EnhancedData] Failed to fetch SEC filings for ${symbol}:`, err.message);
        return undefined;
      })
    ]);

    return {
      symbol: chartData.symbol,
      currentPrice: chartData.currentPrice,
      priceHistory: chartData.priceHistory,
      insights,
      secFilings,
      meta: chartData.meta
    };
  }

  /**
   * Get stock chart data with price history
   */
  private async getChartData(symbol: string, range: string = '3mo') {
    const response = await callDataApi('YahooFinance/get_stock_chart', {
      query: {
        symbol,
        region: 'US',
        interval: '1d',
        range,
        includeAdjustedClose: 'true',
        events: 'div,split'
      }
    });

    const chartResult = (response as any)?.chart?.result?.[0];
    if (!chartResult) {
      throw new Error(`No chart data available for ${symbol}`);
    }

    const result = chartResult;
    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators.quote[0];

    // Build price history
    const priceHistory = timestamps.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000),
      open: quotes.open[i] || 0,
      high: quotes.high[i] || 0,
      low: quotes.low[i] || 0,
      close: quotes.close[i] || 0,
      volume: quotes.volume[i] || 0
    }));

    return {
      symbol: meta.symbol,
      currentPrice: meta.regularMarketPrice || meta.previousClose || 0,
      priceHistory,
      meta: {
        companyName: meta.longName,
        exchange: meta.exchangeName,
        currency: meta.currency,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
        marketCap: meta.marketCap
      }
    };
  }

  /**
   * Get stock insights including technical outlook, company metrics, and research
   */
  async getInsights(symbol: string): Promise<StockInsights | undefined> {
    try {
      const response = await callDataApi('YahooFinance/get_stock_insights', {
        query: { symbol }
      });

      if (!response) {
        return undefined;
      }

      const insights = (response as any).insights || {};
      return {
        symbol: (response as any).symbol || symbol,
        companyName: (response as any).companyName,
        technicalOutlook: (insights as any).technicalOutlook,
        companyMetrics: (insights as any).companyMetrics,
        valuation: (insights as any).valuation,
        researchReports: (insights as any).researchReports || [],
        significantDevelopments: (insights as any).significantDevelopments || []
      };
    } catch (error) {
      console.error(`[EnhancedData] Error fetching insights for ${symbol}:`, error);
      return undefined;
    }
  }

  /**
   * Get SEC filings for a company
   */
  async getSECFilings(symbol: string, limit: number = 10): Promise<SECFiling[] | undefined> {
    try {
      const response = await callDataApi('YahooFinance/get_stock_sec_filing', {
        query: {
          symbol,
          region: 'US',
          lang: 'en-US'
        }
      });

      const filings = (response as any).filings;
      if (!filings) {
        return undefined;
      }

      return filings.slice(0, limit).map((filing: any) => ({
        title: filing.title,
        type: filing.type,
        date: filing.date,
        edgarUrl: filing.edgarUrl,
        maxAge: filing.maxAge
      }));
    } catch (error) {
      console.error(`[EnhancedData] Error fetching SEC filings for ${symbol}:`, error);
      return undefined;
    }
  }

  /**
   * Get latest earnings report from SEC filings
   */
  async getLatestEarningsReport(symbol: string): Promise<SECFiling | undefined> {
    const filings = await this.getSECFilings(symbol, 20);
    if (!filings) return undefined;

    // Look for 10-Q (quarterly) or 10-K (annual) reports
    return filings.find(f => f.type === '10-Q' || f.type === '10-K');
  }

  /**
   * Get recent significant developments
   */
  async getSignificantDevelopments(symbol: string): Promise<Array<{title: string; date: string; description?: string}>> {
    const insights = await this.getInsights(symbol);
    return insights?.significantDevelopments || [];
  }

  /**
   * Batch fetch data for multiple symbols
   */
  async getBatchData(symbols: string[], range: string = '1mo'): Promise<Map<string, ComprehensiveStockData>> {
    console.log(`[EnhancedData] Fetching batch data for ${symbols.length} symbols`);
    
    const results = new Map<string, ComprehensiveStockData>();
    
    // Fetch in parallel with error handling for each symbol
    const promises = symbols.map(async (symbol) => {
      try {
        const data = await this.getComprehensiveData(symbol, range);
        results.set(symbol, data);
      } catch (error: any) {
        console.error(`[EnhancedData] Failed to fetch data for ${symbol}:`, error.message);
      }
    });

    await Promise.all(promises);
    
    return results;
  }

  /**
   * Get company fundamentals summary
   */
  async getFundamentalsSummary(symbol: string): Promise<{
    companyName?: string;
    marketCap?: number;
    fiftyTwoWeekRange: { low: number; high: number };
    technicalOutlook?: string;
    recentFilings: number;
    significantDevelopments: number;
  }> {
    const data = await this.getComprehensiveData(symbol, '1mo');
    
    return {
      companyName: data.meta.companyName,
      marketCap: data.meta.marketCap,
      fiftyTwoWeekRange: {
        low: data.meta.fiftyTwoWeekLow,
        high: data.meta.fiftyTwoWeekHigh
      },
      technicalOutlook: data.insights?.technicalOutlook?.intermediateTerm,
      recentFilings: data.secFilings?.length || 0,
      significantDevelopments: data.insights?.significantDevelopments?.length || 0
    };
  }
}

// Export singleton instance
export const enhancedDataProvider = new EnhancedDataProvider();

