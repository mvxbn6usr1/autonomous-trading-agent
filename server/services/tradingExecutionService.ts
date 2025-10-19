import { randomUUID } from "crypto";
import { createOrder, createPosition, updatePosition, closePosition, getOpenPositions, updateOrder } from "../db";
import { InsertOrder, InsertPosition, Position } from "../../drizzle/schema";
import { TradeSignal } from "./agents";
import { PositionSizeCalculation } from "./riskManagement";
import { getBroker } from "./brokers";

/**
 * Trading Execution Service
 * Handles real order placement via broker integration
 */

export interface OrderResult {
  orderId: string;
  positionId?: string;
  status: "filled" | "pending" | "rejected";
  filledPrice?: number;
  message: string;
}

/**
 * Execute a buy order via the broker
 */
export async function executeBuyOrder(
  signal: TradeSignal,
  strategyId: string,
  userId: string,
  currentPrice: number,
  positionSize: PositionSizeCalculation
): Promise<OrderResult> {
  const orderId = randomUUID();
  const positionId = randomUUID();
  const broker = getBroker();

  try {
    console.log(`[TradingExecution] Placing BUY order: ${positionSize.quantity} ${signal.symbol} @ $${currentPrice}`);

    // Create order record in database
    const order: InsertOrder = {
      id: orderId,
      userId,
      strategyId,
      positionId,
      symbol: signal.symbol,
      side: "buy",
      type: "market",
      quantity: positionSize.quantity,
      filledQuantity: 0,
      status: "pending",
    };

    await createOrder(order);

    // Place order with broker
    const brokerOrder = await broker.placeOrder({
      symbol: signal.symbol,
      side: "buy",
      type: "market",
      quantity: positionSize.quantity,
    });

    console.log(`[TradingExecution] Broker order placed: ${brokerOrder.orderId}, status: ${brokerOrder.status}`);

    // Map broker status to database status (partial -> pending)
    const dbStatus = brokerOrder.status === 'partial' ? 'pending' : brokerOrder.status;

    // Update order record with broker response
    await updateOrder(orderId, {
      status: dbStatus,
      filledQuantity: brokerOrder.filledQuantity,
      filledPrice: Math.round(brokerOrder.averagePrice * 100),
      filledAt: brokerOrder.filledAt || new Date(),
    });

    // If order is filled, create position
    if (brokerOrder.status === "filled") {
      const position: InsertPosition = {
        id: positionId,
        userId,
        strategyId,
        symbol: signal.symbol,
        side: "long",
        quantity: brokerOrder.filledQuantity,
        entryPrice: Math.round(brokerOrder.averagePrice * 100),
        currentPrice: Math.round(brokerOrder.averagePrice * 100),
        stopLoss: Math.round(positionSize.stopLoss * 100),
        takeProfit: Math.round(positionSize.takeProfit * 100),
        unrealizedPnL: 0,
        status: "open",
      };

      await createPosition(position);

      return {
        orderId,
        positionId,
        status: "filled",
        filledPrice: brokerOrder.averagePrice,
        message: `Buy order filled: ${brokerOrder.filledQuantity} ${signal.symbol} at $${brokerOrder.averagePrice.toFixed(2)}`,
      };
    } else {
      return {
        orderId,
        status: "pending",
        message: `Buy order ${brokerOrder.status}: ${signal.symbol}`,
      };
    }
  } catch (error) {
    console.error("[TradingExecution] Buy order failed:", error);

    // Update order as rejected
    await updateOrder(orderId, {
      status: "rejected",
    });

    return {
      orderId,
      status: "rejected",
      message: `Buy order rejected: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Execute a sell order via the broker
 */
export async function executeSellOrder(
  position: Position,
  currentPrice: number,
  reason: string
): Promise<OrderResult> {
  const orderId = randomUUID();
  const broker = getBroker();

  try {
    console.log(`[TradingExecution] Placing SELL order: ${position.quantity} ${position.symbol} @ $${currentPrice} (${reason})`);

    // Create order record
    const order: InsertOrder = {
      id: orderId,
      userId: position.userId,
      strategyId: position.strategyId,
      positionId: position.id,
      symbol: position.symbol,
      side: "sell",
      type: "market",
      quantity: position.quantity,
      filledQuantity: 0,
      status: "pending",
    };

    await createOrder(order);

    // Place order with broker
    const brokerOrder = await broker.placeOrder({
      symbol: position.symbol,
      side: "sell",
      type: "market",
      quantity: position.quantity,
    });

    console.log(`[TradingExecution] Broker order placed: ${brokerOrder.orderId}, status: ${brokerOrder.status}`);

    // Map broker status to database status (partial -> pending)
    const dbStatus = brokerOrder.status === 'partial' ? 'pending' : brokerOrder.status;

    // Update order record
    await updateOrder(orderId, {
      status: dbStatus,
      filledQuantity: brokerOrder.filledQuantity,
      filledPrice: Math.round(brokerOrder.averagePrice * 100),
      filledAt: brokerOrder.filledAt || new Date(),
    });

    // If order is filled, close position
    if (brokerOrder.status === "filled") {
      const realizedPnL = (brokerOrder.averagePrice - position.entryPrice / 100) * brokerOrder.filledQuantity;

      await closePosition(position.id, Math.round(brokerOrder.averagePrice * 100), Math.round(realizedPnL * 100));

      return {
        orderId,
        status: "filled",
        filledPrice: brokerOrder.averagePrice,
        message: `Sell order filled: ${brokerOrder.filledQuantity} ${position.symbol} at $${brokerOrder.averagePrice.toFixed(2)} (P&L: $${realizedPnL.toFixed(2)})`,
      };
    } else {
      return {
        orderId,
        status: "pending",
        message: `Sell order ${brokerOrder.status}: ${position.symbol}`,
      };
    }
  } catch (error) {
    console.error("[TradingExecution] Sell order failed:", error);

    // Update order as rejected
    await updateOrder(orderId, {
      status: "rejected",
    });

    return {
      orderId,
      status: "rejected",
      message: `Sell order rejected: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Monitor positions for stop-loss and take-profit triggers
 */
export async function monitorPositions(strategyId: string, priceMap: Map<string, number>): Promise<void> {
  const positions = await getOpenPositions(strategyId);

  for (const position of positions) {
    const currentPrice = priceMap.get(position.symbol);
    if (!currentPrice) continue;

    // Update current price and unrealized P&L
    const unrealizedPnL = (currentPrice - position.entryPrice / 100) * position.quantity;
    await updatePosition(position.id, {
      currentPrice: Math.round(currentPrice * 100),
      unrealizedPnL: Math.round(unrealizedPnL * 100),
    });

    // Check stop-loss
    if (position.stopLoss && currentPrice <= position.stopLoss / 100) {
      console.log(`[TradingExecution] Stop-loss triggered for ${position.symbol} at $${currentPrice}`);
      await executeSellOrder(position, currentPrice, "Stop-loss triggered");
      continue;
    }

    // Check take-profit
    if (position.takeProfit && currentPrice >= position.takeProfit / 100) {
      console.log(`[TradingExecution] Take-profit triggered for ${position.symbol} at $${currentPrice}`);
      await executeSellOrder(position, currentPrice, "Take-profit triggered");
      continue;
    }
  }
}

/**
 * Update position stop-loss
 */
export async function updatePositionStopLoss(positionId: string, stopLoss: number): Promise<void> {
  await updatePosition(positionId, {
    stopLoss: Math.round(stopLoss * 100),
  });
}

/**
 * Get portfolio summary
 */
export async function getPortfolioSummary(strategyId: string, accountValue: number) {
  const positions = await getOpenPositions(strategyId);

  let totalMarketValue = 0;
  let totalUnrealizedPnL = 0;

  for (const position of positions) {
    const marketValue = (position.currentPrice / 100) * position.quantity;
    totalMarketValue += marketValue;
    totalUnrealizedPnL += position.unrealizedPnL / 100;
  }

  return {
    accountValue,
    totalMarketValue,
    totalUnrealizedPnL,
    cash: accountValue - totalMarketValue,
    positions: positions.length,
  };
}

