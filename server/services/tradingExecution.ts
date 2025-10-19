import { randomUUID } from "crypto";
import { createOrder, createPosition, updatePosition, closePosition, getOpenPositions, updateOrder } from "../db";
import { InsertOrder, InsertPosition, Position } from "../../drizzle/schema";
import { TradeSignal } from "./agents";
import { calculatePositionSize, PositionSizeCalculation } from "./riskManagement";

/**
 * Trading Execution Service
 * Handles order placement, fills, and position management
 */

export interface OrderResult {
  orderId: string;
  positionId?: string;
  status: "filled" | "pending" | "rejected";
  filledPrice?: number;
  message: string;
}

/**
 * Execute a buy order
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

  try {
    // Create order record
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

    // Simulate order execution (in production, this would call broker API)
    const slippage = currentPrice * 0.001; // 0.1% slippage
    const filledPrice = currentPrice + slippage;

    // Update order as filled
    await updateOrder(orderId, {
      status: "filled",
      filledQuantity: positionSize.quantity,
      filledPrice: Math.round(filledPrice * 100),
      filledAt: new Date(),
    });

    // Create position
    const position: InsertPosition = {
      id: positionId,
      userId,
      strategyId,
      symbol: signal.symbol,
      side: "long",
      quantity: positionSize.quantity,
      entryPrice: Math.round(filledPrice * 100),
      currentPrice: Math.round(filledPrice * 100),
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
      filledPrice,
      message: `Buy order filled: ${positionSize.quantity} ${signal.symbol} at $${filledPrice.toFixed(2)}`,
    };
  } catch (error) {
    console.error("[Trading] Buy order failed:", error);

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
 * Execute a sell order (close position)
 */
export async function executeSellOrder(
  position: Position,
  currentPrice: number,
  reason: string = "Manual close"
): Promise<OrderResult> {
  const orderId = randomUUID();

  try {
    // Create sell order
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

    // Simulate order execution
    const slippage = currentPrice * 0.001; // 0.1% slippage
    const filledPrice = currentPrice - slippage;

    // Update order as filled
    await updateOrder(orderId, {
      status: "filled",
      filledQuantity: position.quantity,
      filledPrice: Math.round(filledPrice * 100),
      filledAt: new Date(),
    });

    // Calculate realized P&L
    const entryPrice = position.entryPrice / 100;
    const exitPrice = filledPrice;
    const realizedPnL = position.side === "long"
      ? (exitPrice - entryPrice) * position.quantity
      : (entryPrice - exitPrice) * position.quantity;

    // Close position
    await closePosition(position.id, Math.round(filledPrice * 100), Math.round(realizedPnL * 100));

    return {
      orderId,
      positionId: position.id,
      status: "filled",
      filledPrice,
      message: `Sell order filled: ${position.quantity} ${position.symbol} at $${filledPrice.toFixed(2)}. P&L: $${realizedPnL.toFixed(2)}. Reason: ${reason}`,
    };
  } catch (error) {
    console.error("[Trading] Sell order failed:", error);

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
 * Update position with current market price and unrealized P&L
 */
export async function updatePositionPrice(position: Position, currentPrice: number): Promise<void> {
  const entryPrice = position.entryPrice / 100;
  const unrealizedPnL = position.side === "long"
    ? (currentPrice - entryPrice) * position.quantity
    : (entryPrice - currentPrice) * position.quantity;

  await updatePosition(position.id, {
    currentPrice: Math.round(currentPrice * 100),
    unrealizedPnL: Math.round(unrealizedPnL * 100),
  });
}

/**
 * Update position stop loss
 */
export async function updatePositionStopLoss(positionId: string, newStopLoss: number): Promise<void> {
  await updatePosition(positionId, {
    stopLoss: Math.round(newStopLoss * 100),
  });
}

/**
 * Check and execute stop losses / take profits for all open positions
 */
export async function monitorPositions(strategyId: string, currentPrices: Map<string, number>): Promise<OrderResult[]> {
  const openPositions = await getOpenPositions(strategyId);
  const results: OrderResult[] = [];

  for (const position of openPositions) {
    const currentPrice = currentPrices.get(position.symbol);
    if (!currentPrice) continue;

    // Update position price
    await updatePositionPrice(position, currentPrice);

    // Check stop loss
    const stopLoss = position.stopLoss ? position.stopLoss / 100 : 0;
    const takeProfit = position.takeProfit ? position.takeProfit / 100 : 0;

    let shouldClose = false;
    let closeReason = "";

    if (position.side === "long") {
      if (stopLoss > 0 && currentPrice <= stopLoss) {
        shouldClose = true;
        closeReason = "Stop loss triggered";
      } else if (takeProfit > 0 && currentPrice >= takeProfit) {
        shouldClose = true;
        closeReason = "Take profit triggered";
      }
    } else {
      // Short position
      if (stopLoss > 0 && currentPrice >= stopLoss) {
        shouldClose = true;
        closeReason = "Stop loss triggered";
      } else if (takeProfit > 0 && currentPrice <= takeProfit) {
        shouldClose = true;
        closeReason = "Take profit triggered";
      }
    }

    if (shouldClose) {
      const result = await executeSellOrder(position, currentPrice, closeReason);
      results.push(result);
    }
  }

  return results;
}

/**
 * Calculate portfolio value
 */
export async function calculatePortfolioValue(
  strategyId: string,
  cashBalance: number,
  currentPrices: Map<string, number>
): Promise<number> {
  const openPositions = await getOpenPositions(strategyId);

  let totalValue = cashBalance;

  for (const position of openPositions) {
    const currentPrice = currentPrices.get(position.symbol);
    if (currentPrice) {
      totalValue += position.quantity * currentPrice;
    } else {
      // Use last known price if current price not available
      totalValue += position.quantity * (position.currentPrice / 100);
    }
  }

  return totalValue;
}

/**
 * Get portfolio summary
 */
export async function getPortfolioSummary(strategyId: string, accountValue: number) {
  const openPositions = await getOpenPositions(strategyId);

  const totalPositionValue = openPositions.reduce((sum, pos) => {
    return sum + pos.quantity * (pos.currentPrice / 100);
  }, 0);

  const totalUnrealizedPnL = openPositions.reduce((sum, pos) => {
    return sum + (pos.unrealizedPnL / 100);
  }, 0);

  const cashBalance = accountValue - totalPositionValue;
  const exposurePercent = (totalPositionValue / accountValue) * 100;

  return {
    accountValue,
    cashBalance,
    totalPositionValue,
    totalUnrealizedPnL,
    exposurePercent,
    positionCount: openPositions.length,
    positions: openPositions.map((pos) => ({
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      quantity: pos.quantity,
      entryPrice: pos.entryPrice / 100,
      currentPrice: pos.currentPrice / 100,
      unrealizedPnL: pos.unrealizedPnL / 100,
      unrealizedPnLPercent: ((pos.unrealizedPnL / 100) / (pos.quantity * (pos.entryPrice / 100))) * 100,
      stopLoss: pos.stopLoss ? pos.stopLoss / 100 : null,
      takeProfit: pos.takeProfit ? pos.takeProfit / 100 : null,
      openedAt: pos.openedAt,
    })),
  };
}

