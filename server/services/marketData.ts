/**
 * Market Data Service - Legacy Export
 * This file maintains backward compatibility while using the new modular structure
 */

export { MarketDataService } from './marketData/index';
export type { MarketDataPoint, QuoteData, TechnicalIndicators, Period, Interval } from './marketData/types';
