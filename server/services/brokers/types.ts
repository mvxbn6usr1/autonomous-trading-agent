/**
 * Broker Interface Types
 */

export type BrokerMode = 'mock' | 'paper' | 'live';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'rejected' | 'cancelled';

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
}

export interface OrderResponse {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  filledQuantity: number;
  averagePrice: number;
  status: OrderStatus;
  submittedAt: Date;
  filledAt?: Date;
}

export interface Position {
  symbol: string;
  quantity: number;
  side: 'long' | 'short';
  averageEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

export interface Account {
  accountId: string;
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  equity: number;
}

export interface IBroker {
  mode: BrokerMode;
  getAccount(): Promise<Account>;
  placeOrder(request: OrderRequest): Promise<OrderResponse>;
  getOrder(orderId: string): Promise<OrderResponse>;
  cancelOrder(orderId: string): Promise<boolean>;
  getPositions(): Promise<Position[]>;
  getPosition(symbol: string): Promise<Position | null>;
  closePosition(symbol: string): Promise<OrderResponse>;
  getQuote(symbol: string): Promise<{ price: number; timestamp: Date }>;
  isMarketOpen(): Promise<boolean>;
}
