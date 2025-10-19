/**
 * Alpaca Broker Implementation
 * Real paper/live trading through Alpaca API
 */

import Alpaca from '@alpacahq/alpaca-trade-api';
import { IBroker, BrokerMode, OrderRequest, OrderResponse, Position, Account } from './types';

export class AlpacaBroker implements IBroker {
  mode: BrokerMode;
  private client: Alpaca;

  constructor(mode: BrokerMode = 'paper') {
    this.mode = mode;

    const apiKey = mode === 'paper'
      ? process.env.ALPACA_PAPER_API_KEY
      : process.env.ALPACA_LIVE_API_KEY;
    const apiSecret = mode === 'paper'
      ? process.env.ALPACA_PAPER_API_SECRET
      : process.env.ALPACA_LIVE_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error(`Alpaca ${mode} API credentials not found`);
    }

    console.log(`[AlpacaBroker] Initializing ${mode} mode`);

    this.client = new Alpaca({
      keyId: apiKey,
      secretKey: apiSecret,
      paper: mode === 'paper',
      usePolygon: false,
    });
  }

  async getAccount(): Promise<Account> {
    const account = await this.client.getAccount();
    return {
      accountId: account.id,
      cash: parseFloat(account.cash),
      portfolioValue: parseFloat(account.portfolio_value),
      buyingPower: parseFloat(account.buying_power),
      equity: parseFloat(account.equity),
    };
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    const order = await this.client.createOrder({
      symbol: request.symbol,
      qty: request.quantity,
      side: request.side,
      type: request.type,
      time_in_force: 'day',
    });

    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side as any,
      type: order.type as any,
      quantity: parseInt(order.qty),
      filledQuantity: parseInt(order.filled_qty || '0'),
      averagePrice: parseFloat(order.filled_avg_price || order.limit_price || '0'),
      status: this.mapStatus(order.status),
      submittedAt: new Date(order.submitted_at),
      filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
    };
  }

  async getOrder(orderId: string): Promise<OrderResponse> {
    const order = await this.client.getOrder(orderId);
    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side as any,
      type: order.type as any,
      quantity: parseInt(order.qty),
      filledQuantity: parseInt(order.filled_qty || '0'),
      averagePrice: parseFloat(order.filled_avg_price || order.limit_price || '0'),
      status: this.mapStatus(order.status),
      submittedAt: new Date(order.submitted_at),
      filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.client.cancelOrder(orderId);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getPositions(): Promise<Position[]> {
    const positions = await this.client.getPositions();
    return positions.map((pos: any) => ({
      symbol: pos.symbol,
      quantity: parseInt(pos.qty),
      side: parseInt(pos.qty) > 0 ? 'long' : 'short',
      averageEntryPrice: parseFloat(pos.avg_entry_price),
      currentPrice: parseFloat(pos.current_price),
      marketValue: parseFloat(pos.market_value),
      costBasis: parseFloat(pos.cost_basis),
      unrealizedPL: parseFloat(pos.unrealized_pl),
      unrealizedPLPercent: parseFloat(pos.unrealized_plpc),
    }));
  }

  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const pos = await this.client.getPosition(symbol);
      return {
        symbol: pos.symbol,
        quantity: parseInt(pos.qty),
        side: parseInt(pos.qty) > 0 ? 'long' : 'short',
        averageEntryPrice: parseFloat(pos.avg_entry_price),
        currentPrice: parseFloat(pos.current_price),
        marketValue: parseFloat(pos.market_value),
        costBasis: parseFloat(pos.cost_basis),
        unrealizedPL: parseFloat(pos.unrealized_pl),
        unrealizedPLPercent: parseFloat(pos.unrealized_plpc),
      };
    } catch (error) {
      return null;
    }
  }

  async closePosition(symbol: string): Promise<OrderResponse> {
    const order = await this.client.closePosition(symbol);
    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side as any,
      type: order.type as any,
      quantity: parseInt(order.qty),
      filledQuantity: parseInt(order.filled_qty || '0'),
      averagePrice: parseFloat(order.filled_avg_price || '0'),
      status: this.mapStatus(order.status),
      submittedAt: new Date(order.submitted_at),
      filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
    };
  }

  async getQuote(symbol: string): Promise<{ price: number; timestamp: Date }> {
    const trade = await this.client.getLatestTrade(symbol);
    return {
      price: trade.Price,
      timestamp: new Date(trade.Timestamp),
    };
  }

  async isMarketOpen(): Promise<boolean> {
    const clock = await this.client.getClock();
    return clock.is_open;
  }

  private mapStatus(status: string): 'pending' | 'filled' | 'partial' | 'rejected' | 'cancelled' {
    switch (status) {
      case 'filled': return 'filled';
      case 'partially_filled': return 'partial';
      case 'rejected': return 'rejected';
      case 'canceled': return 'cancelled';
      default: return 'pending';
    }
  }
}
