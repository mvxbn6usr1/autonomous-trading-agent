import { randomUUID } from "crypto";
import { Position, Strategy } from "../../drizzle/schema";
import { createRiskAlert, getOpenPositions } from "../db";
import { TradeSignal } from "./agents";

/**
 * Risk Management Service
 * Implements position sizing, stop losses, and risk limits
 */

export interface RiskCheck {
  passed: boolean;
  reason?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

export interface PositionSizeCalculation {
  quantity: number;
  positionValue: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
}

/**
 * Calculate position size based on risk parameters
 */
export function calculatePositionSize(
  signal: TradeSignal,
  currentPrice: number,
  accountValue: number,
  riskPercentage: number = 2,
  atr: number = 0
): PositionSizeCalculation {
  // Risk amount per trade (typically 1-2% of account)
  const riskAmount = accountValue * (riskPercentage / 100);

  // Calculate stop loss distance (using ATR if available)
  const stopLossDistance = atr > 0 ? atr * 2 : currentPrice * 0.02; // 2% default

  // Position size = Risk Amount / Stop Loss Distance
  const positionValue = riskAmount / (stopLossDistance / currentPrice);

  // Ensure position doesn't exceed max position size
  const maxPositionValue = accountValue * 0.1; // Max 10% per position
  const finalPositionValue = Math.min(positionValue, maxPositionValue);

  const quantity = Math.floor(finalPositionValue / currentPrice);

  // Calculate stop loss and take profit levels
  const stopLoss = signal.action === "buy" ? currentPrice - stopLossDistance : currentPrice + stopLossDistance;

  const takeProfitDistance = stopLossDistance * 2; // 2:1 reward/risk ratio
  const takeProfit = signal.action === "buy" ? currentPrice + takeProfitDistance : currentPrice - takeProfitDistance;

  return {
    quantity,
    positionValue: quantity * currentPrice,
    stopLoss,
    takeProfit,
    riskAmount,
  };
}

/**
 * Pre-trade risk checks
 */
export async function validatePreTradeRisks(
  signal: TradeSignal,
  strategyId: string,
  userId: string,
  strategy: Strategy,
  accountValue: number,
  currentPrice: number
): Promise<{ checks: RiskCheck[]; approved: boolean }> {
  const checks: RiskCheck[] = [];

  // Get current open positions
  const openPositions = await getOpenPositions(strategyId);

  // Check 1: Position size limit
  const positionSize = calculatePositionSize(signal, currentPrice, accountValue, strategy.maxPositionSize);
  const positionSizePercent = (positionSize.positionValue / accountValue) * 100;

  if (positionSizePercent > strategy.maxPositionSize) {
    checks.push({
      passed: false,
      reason: `Position size ${positionSizePercent.toFixed(2)}% exceeds limit of ${strategy.maxPositionSize}%`,
      severity: "high",
    });

    await createRiskAlert({
      id: randomUUID(),
      userId,
      strategyId,
      alertType: "position_size_exceeded",
      severity: "high",
      message: `Position size limit exceeded: ${positionSizePercent.toFixed(2)}% > ${strategy.maxPositionSize}%`,
      metadata: JSON.stringify({ signal, positionSize }),
    });
  } else {
    checks.push({
      passed: true,
      reason: `Position size ${positionSizePercent.toFixed(2)}% within limit`,
    });
  }

  // Check 2: Total portfolio exposure
  const totalExposure = openPositions.reduce((sum, pos) => {
    return sum + Math.abs(pos.quantity * (pos.currentPrice / 100));
  }, 0);

  const exposurePercent = (totalExposure / accountValue) * 100;
  const maxExposure = 50; // Max 50% total exposure

  if (exposurePercent > maxExposure) {
    checks.push({
      passed: false,
      reason: `Total exposure ${exposurePercent.toFixed(2)}% exceeds maximum ${maxExposure}%`,
      severity: "critical",
    });

    await createRiskAlert({
      id: randomUUID(),
      userId,
      strategyId,
      alertType: "position_size_exceeded",
      severity: "critical",
      message: `Total portfolio exposure too high: ${exposurePercent.toFixed(2)}%`,
      metadata: JSON.stringify({ totalExposure, accountValue }),
    });
  } else {
    checks.push({
      passed: true,
      reason: `Total exposure ${exposurePercent.toFixed(2)}% within limits`,
    });
  }

  // Check 3: Maximum number of positions
  const maxPositions = 10;
  if (openPositions.length >= maxPositions) {
    checks.push({
      passed: false,
      reason: `Maximum number of positions (${maxPositions}) reached`,
      severity: "medium",
    });
  } else {
    checks.push({
      passed: true,
      reason: `Position count ${openPositions.length}/${maxPositions} acceptable`,
    });
  }

  // Check 4: Price reasonableness (prevent fat-finger errors)
  if (currentPrice <= 0 || !isFinite(currentPrice)) {
    checks.push({
      passed: false,
      reason: `Invalid price: $${currentPrice}`,
      severity: "critical",
    });
  } else {
    checks.push({
      passed: true,
      reason: "Price validation passed",
    });
  }

  // Check 5: Confidence threshold
  const minConfidence = 60;
  if (signal.confidence < minConfidence) {
    checks.push({
      passed: false,
      reason: `Signal confidence ${signal.confidence}% below minimum ${minConfidence}%`,
      severity: "medium",
    });
  } else {
    checks.push({
      passed: true,
      reason: `Signal confidence ${signal.confidence}% acceptable`,
    });
  }

  const approved = checks.every((check) => check.passed);

  return { checks, approved };
}

/**
 * Check if daily loss limit has been reached
 */
export function checkDailyLossLimit(
  dailyPnL: number,
  accountValue: number,
  dailyLossLimit: number
): RiskCheck {
  const dailyLossPercent = (Math.abs(dailyPnL) / accountValue) * 100;

  if (dailyPnL < 0 && dailyLossPercent >= dailyLossLimit) {
    return {
      passed: false,
      reason: `Daily loss limit reached: ${dailyLossPercent.toFixed(2)}% >= ${dailyLossLimit}%`,
      severity: "critical",
    };
  }

  return {
    passed: true,
    reason: `Daily P&L within limits: ${dailyLossPercent.toFixed(2)}%`,
  };
}

/**
 * Calculate portfolio metrics
 */
export function calculatePortfolioMetrics(positions: Position[], accountValue: number) {
  const totalPositionValue = positions.reduce((sum, pos) => {
    return sum + Math.abs(pos.quantity * (pos.currentPrice / 100));
  }, 0);

  const totalUnrealizedPnL = positions.reduce((sum, pos) => {
    return sum + (pos.unrealizedPnL / 100);
  }, 0);

  const exposurePercent = (totalPositionValue / accountValue) * 100;

  return {
    totalPositionValue,
    totalUnrealizedPnL,
    exposurePercent,
    positionCount: positions.length,
    accountValue,
  };
}

/**
 * Update stop loss dynamically based on ATR (trailing stop)
 */
export function calculateTrailingStop(
  position: Position,
  currentPrice: number,
  atr: number,
  multiplier: number = 2
): number {
  const entryPrice = position.entryPrice / 100;
  const currentStopLoss = position.stopLoss ? position.stopLoss / 100 : 0;

  if (position.side === "long") {
    // For long positions, move stop loss up as price increases
    const newStopLoss = currentPrice - atr * multiplier;

    // Only move stop loss up, never down
    return Math.max(newStopLoss, currentStopLoss, entryPrice * 0.98) * 100; // At least 2% below entry
  } else {
    // For short positions, move stop loss down as price decreases
    const newStopLoss = currentPrice + atr * multiplier;

    // Only move stop loss down, never up
    if (currentStopLoss === 0) {
      return newStopLoss * 100;
    }
    return Math.min(newStopLoss, currentStopLoss, entryPrice * 1.02) * 100; // At least 2% above entry
  }
}

/**
 * Check if position should be closed due to stop loss or take profit
 */
export function shouldClosePosition(position: Position, currentPrice: number): {
  shouldClose: boolean;
  reason?: string;
} {
  const price = currentPrice;
  const stopLoss = position.stopLoss ? position.stopLoss / 100 : 0;
  const takeProfit = position.takeProfit ? position.takeProfit / 100 : 0;

  if (position.side === "long") {
    if (stopLoss > 0 && price <= stopLoss) {
      return { shouldClose: true, reason: "Stop loss triggered" };
    }
    if (takeProfit > 0 && price >= takeProfit) {
      return { shouldClose: true, reason: "Take profit triggered" };
    }
  } else {
    // Short position
    if (stopLoss > 0 && price >= stopLoss) {
      return { shouldClose: true, reason: "Stop loss triggered" };
    }
    if (takeProfit > 0 && price <= takeProfit) {
      return { shouldClose: true, reason: "Take profit triggered" };
    }
  }

  return { shouldClose: false };
}

/**
 * Calculate Value at Risk (VaR) using historical simulation
 */
export function calculateVaR(returns: number[], confidenceLevel: number = 0.95): number {
  if (returns.length === 0) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);

  return sortedReturns[index] || 0;
}

/**
 * Calculate Sharpe Ratio
 */
export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Annualized Sharpe Ratio (assuming daily returns)
  const excessReturn = avgReturn - riskFreeRate / 252; // Daily risk-free rate
  return (excessReturn / stdDev) * Math.sqrt(252);
}

/**
 * Calculate Maximum Drawdown
 */
export function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = equityCurve[0];

  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown * 100; // Return as percentage
}

