/**
 * Alpaca Broker - Real API integration for paper and live trading
 * Requires ALPACA_API_KEY and ALPACA_API_SECRET environment variables
 */

import Alpaca from '@alpacahq/alpaca-trade-api';
import { IBroker, BrokerMode, OrderRequest, OrderResponse, Position, Account, Quote } from './types';

export class AlpacaBroker implements IBroker {
  mode: BrokerMode;
  private client: Alpaca;
  
  constructor(mode: BrokerMode = 'paper') {
    this.mode = mode;
    
    const apiKey = process.env.ALPACA_API_KEY;
    const apiSecret = process.env.ALPACA_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('ALPACA_API_KEY and ALPACA_API_SECRET must be set');
    }
    
    this.client = new Alpaca({
      keyId: apiKey,
      secretKey: apiSecret,
      paper: mode === 'paper', // Use paper trading for 'paper' mode
      usePolygon: false, // Use Alpaca's data feed
    });
  }
  
  async getAccount(): Promise<Account> {
    try {
      const account = await this.client.getAccount();
      
      return {
        accountId: account.id,
        cash: parseFloat(account.cash),
        portfolioValue: parseFloat(account.portfolio_value),
        buyingPower: parseFloat(account.buying_power),
        equity: parseFloat(account.equity),
        lastEquity: parseFloat(account.last_equity),
        dayTradeCount: parseInt(account.daytrade_count || '0'),
        patternDayTrader: account.pattern_day_trader,
      };
    } catch (error: any) {
      console.error('[AlpacaBroker] Error getting account:', error);
      throw new Error(`Failed to get account: ${error.message}`);
    }
  }
  
  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    try {
      const alpacaOrder = await this.client.createOrder({
        symbol: order.symbol,
        qty: order.quantity,
        side: order.side,
        type: order.type,
        time_in_force: order.timeInForce || 'day',
        limit_price: order.limitPrice,
        stop_price: order.stopPrice,
      });
      
      return {
        orderId: alpacaOrder.id,
        symbol: alpacaOrder.symbol,
        side: alpacaOrder.side as 'buy' | 'sell',
        type: alpacaOrder.type as any,
        quantity: parseFloat(alpacaOrder.qty),
        filledQuantity: parseFloat(alpacaOrder.filled_qty || '0'),
        averagePrice: alpacaOrder.filled_avg_price ? parseFloat(alpacaOrder.filled_avg_price) : undefined,
        status: this.mapAlpacaStatus(alpacaOrder.status),
        submittedAt: new Date(alpacaOrder.submitted_at),
        filledAt: alpacaOrder.filled_at ? new Date(alpacaOrder.filled_at) : undefined,
      };
    } catch (error: any) {
      console.error('[AlpacaBroker] Error placing order:', error);
      throw new Error(`Failed to place order: ${error.message}`);
    }
  }
  
  private mapAlpacaStatus(status: string): OrderResponse['status'] {
    switch (status) {
      case 'new':
      case 'pending_new':
      case 'accepted':
      case 'pending_replace':
        return 'pending';
      case 'filled':
        return 'filled';
      case 'partially_filled':
        return 'partial';
      case 'canceled':
      case 'expired':
      case 'replaced':
        return 'canceled';
      case 'rejected':
      case 'suspended':
      case 'pending_cancel':
        return 'rejected';
      default:
        return 'pending';
    }
  }
  
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.client.cancelOrder(orderId);
    } catch (error: any) {
      console.error('[AlpacaBroker] Error canceling order:', error);
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }
  
  async getOrder(orderId: string): Promise<OrderResponse> {
    try {
      const order = await this.client.getOrder(orderId);
      
      return {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        type: order.type as any,
        quantity: parseFloat(order.qty),
        filledQuantity: parseFloat(order.filled_qty || '0'),
        averagePrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : undefined,
        status: this.mapAlpacaStatus(order.status),
        submittedAt: new Date(order.submitted_at),
        filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
      };
    } catch (error: any) {
      console.error('[AlpacaBroker] Error getting order:', error);
      throw new Error(`Failed to get order: ${error.message}`);
    }
  }
  
  async getPositions(): Promise<Position[]> {
    try {
      const positions = await this.client.getPositions();
      
      return positions.map((p: any) => ({
        symbol: p.symbol,
        quantity: parseFloat(p.qty),
        averageEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        costBasis: parseFloat(p.cost_basis),
        unrealizedPL: parseFloat(p.unrealized_pl),
        unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100,
        side: p.side as 'long' | 'short',
      }));
    } catch (error: any) {
      console.error('[AlpacaBroker] Error getting positions:', error);
      throw new Error(`Failed to get positions: ${error.message}`);
    }
  }
  
  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const position = await this.client.getPosition(symbol);
      
      return {
        symbol: position.symbol,
        quantity: parseFloat(position.qty),
        averageEntryPrice: parseFloat(position.avg_entry_price),
        currentPrice: parseFloat(position.current_price),
        marketValue: parseFloat(position.market_value),
        costBasis: parseFloat(position.cost_basis),
        unrealizedPL: parseFloat(position.unrealized_pl),
        unrealizedPLPercent: parseFloat(position.unrealized_plpc) * 100,
        side: position.side as 'long' | 'short',
      };
    } catch (error: any) {
      if (error.message?.includes('position does not exist')) {
        return null;
      }
      console.error('[AlpacaBroker] Error getting position:', error);
      throw new Error(`Failed to get position: ${error.message}`);
    }
  }
  
  async closePosition(symbol: string): Promise<OrderResponse> {
    try {
      const result = await this.client.closePosition(symbol);
      
      return {
        orderId: result.id,
        symbol: result.symbol,
        side: result.side as 'buy' | 'sell',
        type: result.type as any,
        quantity: parseFloat(result.qty),
        filledQuantity: parseFloat(result.filled_qty || '0'),
        averagePrice: result.filled_avg_price ? parseFloat(result.filled_avg_price) : undefined,
        status: this.mapAlpacaStatus(result.status),
        submittedAt: new Date(result.submitted_at),
        filledAt: result.filled_at ? new Date(result.filled_at) : undefined,
      };
    } catch (error: any) {
      console.error('[AlpacaBroker] Error closing position:', error);
      throw new Error(`Failed to close position: ${error.message}`);
    }
  }
  
  async getQuote(symbol: string): Promise<Quote> {
    try {
      const quote: any = await this.client.getLatestQuote(symbol);
      
      return {
        symbol,
        bid: quote.BidPrice || quote.bp || 0,
        ask: quote.AskPrice || quote.ap || 0,
        last: quote.LastPrice || ((quote.BidPrice + quote.AskPrice) / 2) || ((quote.bp + quote.ap) / 2) || 0,
        volume: quote.Volume || 0,
        timestamp: new Date(quote.Timestamp || quote.t || Date.now()),
      };
    } catch (error: any) {
      console.error('[AlpacaBroker] Error getting quote:', error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }
  
  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.map(s => this.getQuote(s)));
  }
  
  async isMarketOpen(): Promise<boolean> {
    try {
      const clock = await this.client.getClock();
      return clock.is_open;
    } catch (error: any) {
      console.error('[AlpacaBroker] Error checking market status:', error);
      // Default to closed if error
      return false;
    }
  }
}

