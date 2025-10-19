/**
 * Mock Broker - Simulates trade execution without real API calls
 * Useful for testing and development
 */

import { IBroker, BrokerMode, OrderRequest, OrderResponse, Position, Account, Quote, OrderStatus } from './types';

export class MockBroker implements IBroker {
  mode: BrokerMode = 'mock';
  
  private account: Account;
  private positions: Map<string, Position> = new Map();
  private orders: Map<string, OrderResponse> = new Map();
  private orderCounter = 0;
  
  constructor(initialCash: number = 100000) {
    this.account = {
      accountId: 'mock-account',
      cash: initialCash,
      portfolioValue: initialCash,
      buyingPower: initialCash,
      equity: initialCash,
      lastEquity: initialCash,
    };
  }
  
  async getAccount(): Promise<Account> {
    // Update portfolio value based on positions
    let positionsValue = 0;
    for (const position of this.positions.values()) {
      positionsValue += position.marketValue;
    }
    
    this.account.portfolioValue = this.account.cash + positionsValue;
    this.account.equity = this.account.portfolioValue;
    
    return { ...this.account };
  }
  
  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    const orderId = `mock-order-${++this.orderCounter}`;
    
    // Get current price (simulate with random price around $100)
    const quote = await this.getQuote(order.symbol);
    const fillPrice = order.type === 'market' 
      ? (order.side === 'buy' ? quote.ask : quote.bid)
      : order.limitPrice || quote.last;
    
    // Calculate cost
    const cost = fillPrice * order.quantity;
    
    // Check if we have enough cash for buy orders
    if (order.side === 'buy' && cost > this.account.cash) {
      const response: OrderResponse = {
        orderId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        filledQuantity: 0,
        status: 'rejected',
        submittedAt: new Date(),
      };
      this.orders.set(orderId, response);
      throw new Error(`Insufficient funds: need $${cost.toFixed(2)}, have $${this.account.cash.toFixed(2)}`);
    }
    
    // Simulate immediate fill for market orders
    const response: OrderResponse = {
      orderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      filledQuantity: order.quantity,
      averagePrice: fillPrice,
      status: 'filled',
      submittedAt: new Date(),
      filledAt: new Date(),
    };
    
    this.orders.set(orderId, response);
    
    // Update positions
    await this.updatePosition(order.symbol, order.side, order.quantity, fillPrice);
    
    return response;
  }
  
  private async updatePosition(symbol: string, side: 'buy' | 'sell', quantity: number, price: number) {
    const existing = this.positions.get(symbol);
    
    if (side === 'buy') {
      // Buying - increase position
      if (existing) {
        const totalCost = existing.costBasis + (price * quantity);
        const totalQuantity = existing.quantity + quantity;
        existing.quantity = totalQuantity;
        existing.averageEntryPrice = totalCost / totalQuantity;
        existing.costBasis = totalCost;
      } else {
        this.positions.set(symbol, {
          symbol,
          quantity,
          averageEntryPrice: price,
          currentPrice: price,
          marketValue: price * quantity,
          costBasis: price * quantity,
          unrealizedPL: 0,
          unrealizedPLPercent: 0,
          side: 'long',
        });
      }
      this.account.cash -= price * quantity;
    } else {
      // Selling - decrease position
      if (existing) {
        if (existing.quantity < quantity) {
          throw new Error(`Cannot sell ${quantity} shares, only have ${existing.quantity}`);
        }
        existing.quantity -= quantity;
        const proceeds = price * quantity;
        this.account.cash += proceeds;
        
        if (existing.quantity === 0) {
          this.positions.delete(symbol);
        }
      } else {
        throw new Error(`No position to sell for ${symbol}`);
      }
    }
  }
  
  async cancelOrder(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    if (order.status === 'filled') {
      throw new Error(`Cannot cancel filled order ${orderId}`);
    }
    
    order.status = 'canceled';
  }
  
  async getOrder(orderId: string): Promise<OrderResponse> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return { ...order };
  }
  
  async getPositions(): Promise<Position[]> {
    // Update current prices and P&L
    const positions: Position[] = [];
    
    for (const position of this.positions.values()) {
      const quote = await this.getQuote(position.symbol);
      position.currentPrice = quote.last;
      position.marketValue = position.currentPrice * position.quantity;
      position.unrealizedPL = position.marketValue - position.costBasis;
      position.unrealizedPLPercent = (position.unrealizedPL / position.costBasis) * 100;
      positions.push({ ...position });
    }
    
    return positions;
  }
  
  async getPosition(symbol: string): Promise<Position | null> {
    const position = this.positions.get(symbol);
    if (!position) return null;
    
    // Update current price and P&L
    const quote = await this.getQuote(symbol);
    position.currentPrice = quote.last;
    position.marketValue = position.currentPrice * position.quantity;
    position.unrealizedPL = position.marketValue - position.costBasis;
    position.unrealizedPLPercent = (position.unrealizedPL / position.costBasis) * 100;
    
    return { ...position };
  }
  
  async closePosition(symbol: string): Promise<OrderResponse> {
    const position = await this.getPosition(symbol);
    if (!position) {
      throw new Error(`No position found for ${symbol}`);
    }
    
    return this.placeOrder({
      symbol,
      side: 'sell',
      type: 'market',
      quantity: position.quantity,
    });
  }
  
  async getQuote(symbol: string): Promise<Quote> {
    // Simulate realistic stock prices
    const basePrice = 100 + (symbol.charCodeAt(0) % 50);
    const spread = basePrice * 0.001; // 0.1% spread
    const last = basePrice + (Math.random() - 0.5) * 2;
    
    return {
      symbol,
      bid: last - spread / 2,
      ask: last + spread / 2,
      last,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date(),
    };
  }
  
  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.map(s => this.getQuote(s)));
  }
  
  async isMarketOpen(): Promise<boolean> {
    // Simulate market hours (9:30 AM - 4:00 PM ET on weekdays)
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // Weekend
    if (day === 0 || day === 6) return false;
    
    // Weekday - check hours (simplified, doesn't account for timezone)
    return hour >= 9 && hour < 16;
  }
}

