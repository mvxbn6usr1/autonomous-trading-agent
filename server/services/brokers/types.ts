/**
 * Broker Interface - Abstract interface for trade execution
 * Supports mock, paper, and live trading modes
 */

export type BrokerMode = 'mock' | 'paper' | 'live';

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'canceled' | 'rejected';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce?: TimeInForce;
}

export interface OrderResponse {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  averagePrice?: number;
  status: OrderStatus;
  submittedAt: Date;
  filledAt?: Date;
}

export interface Position {
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  side: 'long' | 'short';
}

export interface Account {
  accountId: string;
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  equity: number;
  lastEquity: number;
  dayTradeCount?: number;
  patternDayTrader?: boolean;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: Date;
}

/**
 * Abstract broker interface
 * Implementations: MockBroker, AlpacaBroker
 */
export interface IBroker {
  mode: BrokerMode;
  
  // Account operations
  getAccount(): Promise<Account>;
  
  // Order operations
  placeOrder(order: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<OrderResponse>;
  
  // Position operations
  getPositions(): Promise<Position[]>;
  getPosition(symbol: string): Promise<Position | null>;
  closePosition(symbol: string): Promise<OrderResponse>;
  
  // Market data
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  
  // Utility
  isMarketOpen(): Promise<boolean>;
}

