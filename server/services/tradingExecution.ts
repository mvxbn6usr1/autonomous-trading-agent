/**
 * Trading Execution Service - Handles actual trade execution through brokers
 * Integrates with mock/paper/live brokers
 */

import { getBroker, OrderRequest, OrderResponse, Position } from './brokers';
import { getDb } from '../db';
import { orders, positions, InsertOrder, InsertPosition } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

export interface TradeSignal {
  strategyId: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  quantity?: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasoning: string;
  confidence: number;
}

export class TradingExecutionService {
  private broker = getBroker();
  
  /**
   * Execute a trade signal
   */
  async executeTrade(signal: TradeSignal): Promise<OrderResponse | null> {
    if (signal.action === 'hold') {
      console.log(`[TradingExecution] HOLD signal for ${signal.symbol}, no action taken`);
      return null;
    }
    
    try {
      console.log(`[TradingExecution] Executing ${signal.action.toUpperCase()} for ${signal.symbol}`);
      
      // Check if market is open
      const isOpen = await this.broker.isMarketOpen();
      if (!isOpen) {
        console.warn(`[TradingExecution] Market is closed, cannot execute trade`);
        return null;
      }
      
      // Get account info
      const account = await this.broker.getAccount();
      console.log(`[TradingExecution] Account cash: $${account.cash.toFixed(2)}, Portfolio: $${account.portfolioValue.toFixed(2)}`);
      
      // Calculate position size if not provided
      let quantity = signal.quantity;
      if (!quantity) {
        // Use 2% of portfolio value for position sizing
        const positionValue = account.portfolioValue * 0.02;
        const currentPrice = signal.price || (await this.broker.getQuote(signal.symbol)).last;
        quantity = Math.floor(positionValue / currentPrice);
        
        if (quantity < 1) {
          console.warn(`[TradingExecution] Calculated quantity is 0, skipping trade`);
          return null;
        }
      }
      
      // For sell orders, check if we have the position
      if (signal.action === 'sell') {
        const existingPosition = await this.broker.getPosition(signal.symbol);
        if (!existingPosition) {
          console.warn(`[TradingExecution] No position to sell for ${signal.symbol}`);
          return null;
        }
        quantity = Math.min(quantity, existingPosition.quantity);
      }
      
      // Create order request
      const orderRequest: OrderRequest = {
        symbol: signal.symbol,
        side: signal.action,
        type: 'market', // Use market orders for simplicity
        quantity,
        timeInForce: 'day',
      };
      
      // Place order through broker
      console.log(`[TradingExecution] Placing order:`, orderRequest);
      const orderResponse = await this.broker.placeOrder(orderRequest);
      console.log(`[TradingExecution] Order placed:`, orderResponse);
      
      // Save order to database
      await this.saveOrder(signal.strategyId, orderResponse, signal);
      
      // If order is filled, update position
      if (orderResponse.status === 'filled') {
        await this.updatePosition(signal.strategyId, orderResponse, signal);
      }
      
      return orderResponse;
    } catch (error: any) {
      console.error(`[TradingExecution] Error executing trade:`, error);
      throw error;
    }
  }
  
  /**
   * Save order to database
   */
  private async saveOrder(strategyId: string, orderResponse: OrderResponse, signal: TradeSignal): Promise<void> {
    const db = await getDb();
    if (!db) return;
    
    try {
      const orderData: InsertOrder = {
        id: orderResponse.orderId,
        strategyId,
        symbol: orderResponse.symbol,
        side: orderResponse.side,
        type: orderResponse.type,
        quantity: orderResponse.quantity,
        filledQuantity: orderResponse.filledQuantity,
        price: orderResponse.averagePrice,
        status: orderResponse.status,
        submittedAt: orderResponse.submittedAt,
        filledAt: orderResponse.filledAt,
      };
      
      await db.insert(orders).values(orderData);
      console.log(`[TradingExecution] Order saved to database: ${orderResponse.orderId}`);
    } catch (error) {
      console.error(`[TradingExecution] Error saving order:`, error);
    }
  }
  
  /**
   * Update position in database
   */
  private async updatePosition(strategyId: string, orderResponse: OrderResponse, signal: TradeSignal): Promise<void> {
    const db = await getDb();
    if (!db) return;
    
    try {
      // Get current broker position
      const brokerPosition = await this.broker.getPosition(orderResponse.symbol);
      
      if (!brokerPosition) {
        // Position was closed
        await db.delete(positions).where(
          and(
            eq(positions.strategyId, strategyId),
            eq(positions.symbol, orderResponse.symbol)
          )
        );
        console.log(`[TradingExecution] Position closed for ${orderResponse.symbol}`);
        return;
      }
      
      // Check if position exists in database
      const existing = await db.select().from(positions).where(
        and(
          eq(positions.strategyId, strategyId),
          eq(positions.symbol, orderResponse.symbol)
        )
      ).limit(1);
      
      const positionData: InsertPosition = {
        strategyId,
        symbol: brokerPosition.symbol,
        quantity: brokerPosition.quantity,
        averagePrice: brokerPosition.averageEntryPrice,
        currentPrice: brokerPosition.currentPrice,
        unrealizedPL: brokerPosition.unrealizedPL,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        openedAt: existing.length > 0 ? existing[0].openedAt : new Date(),
      };
      
      if (existing.length > 0) {
        // Update existing position
        await db.update(positions)
          .set(positionData)
          .where(
            and(
              eq(positions.strategyId, strategyId),
              eq(positions.symbol, orderResponse.symbol)
            )
          );
        console.log(`[TradingExecution] Position updated for ${orderResponse.symbol}`);
      } else {
        // Insert new position
        await db.insert(positions).values(positionData);
        console.log(`[TradingExecution] New position created for ${orderResponse.symbol}`);
      }
    } catch (error) {
      console.error(`[TradingExecution] Error updating position:`, error);
    }
  }
  
  /**
   * Monitor positions and execute stop-loss/take-profit
   */
  async monitorPositions(strategyId: string): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;
      
      // Get all open positions for this strategy
      const openPositions = await db.select().from(positions).where(
        eq(positions.strategyId, strategyId)
      );
      
      for (const position of openPositions) {
        // Get current price from broker
        const brokerPosition = await this.broker.getPosition(position.symbol);
        if (!brokerPosition) {
          // Position no longer exists in broker, remove from database
          await db.delete(positions).where(
            and(
              eq(positions.strategyId, strategyId),
              eq(positions.symbol, position.symbol)
            )
          );
          continue;
        }
        
        const currentPrice = brokerPosition.currentPrice;
        
        // Check stop-loss
        if (position.stopLoss && currentPrice <= position.stopLoss) {
          console.log(`[TradingExecution] Stop-loss triggered for ${position.symbol} at $${currentPrice} (stop: $${position.stopLoss})`);
          await this.closePosition(strategyId, position.symbol, 'stop-loss');
          continue;
        }
        
        // Check take-profit
        if (position.takeProfit && currentPrice >= position.takeProfit) {
          console.log(`[TradingExecution] Take-profit triggered for ${position.symbol} at $${currentPrice} (target: $${position.takeProfit})`);
          await this.closePosition(strategyId, position.symbol, 'take-profit');
          continue;
        }
        
        // Update current price and P&L
        await db.update(positions)
          .set({
            currentPrice: brokerPosition.currentPrice,
            unrealizedPL: brokerPosition.unrealizedPL,
          })
          .where(
            and(
              eq(positions.strategyId, strategyId),
              eq(positions.symbol, position.symbol)
            )
          );
      }
    } catch (error) {
      console.error(`[TradingExecution] Error monitoring positions:`, error);
    }
  }
  
  /**
   * Close a position
   */
  async closePosition(strategyId: string, symbol: string, reason: string): Promise<void> {
    try {
      console.log(`[TradingExecution] Closing position ${symbol} (reason: ${reason})`);
      
      const orderResponse = await this.broker.closePosition(symbol);
      
      // Save closing order
      await this.saveOrder(strategyId, orderResponse, {
        strategyId,
        symbol,
        action: 'sell',
        reasoning: `Position closed: ${reason}`,
        confidence: 1.0,
      });
      
      // Remove position from database
      const db = await getDb();
      if (db) {
        await db.delete(positions).where(
          and(
            eq(positions.strategyId, strategyId),
            eq(positions.symbol, symbol)
          )
        );
      }
      
      console.log(`[TradingExecution] Position ${symbol} closed successfully`);
    } catch (error) {
      console.error(`[TradingExecution] Error closing position:`, error);
    }
  }
  
  /**
   * Get current positions from broker
   */
  async getBrokerPositions(): Promise<Position[]> {
    return this.broker.getPositions();
  }
  
  /**
   * Get account information
   */
  async getAccount() {
    return this.broker.getAccount();
  }
}

