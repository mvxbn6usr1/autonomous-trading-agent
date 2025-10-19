// Performance metrics calculations for backtesting

import { BacktestTrade } from './types';

export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length
  );
  
  if (stdReturn === 0) return 0;
  
  // Annualized Sharpe ratio (assuming 252 trading days)
  const excessReturn = avgReturn - (riskFreeRate / 252);
  return (excessReturn / stdReturn) * Math.sqrt(252);
}

export function calculateMaxDrawdown(equityCurve: { date: Date; value: number }[]): number {
  if (equityCurve.length === 0) return 0;
  
  let maxDrawdown = 0;
  let peak = equityCurve[0].value;
  
  for (const point of equityCurve) {
    if (point.value > peak) {
      peak = point.value;
    }
    const drawdown = (peak - point.value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

export function calculateWinRate(trades: BacktestTrade[]): number {
  if (trades.length === 0) return 0;
  
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  return winningTrades / trades.length;
}

export function calculateProfitFactor(trades: BacktestTrade[]): number {
  if (trades.length === 0) return 0;
  
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
  
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  
  return grossProfit / grossLoss;
}

export function calculateTotalReturn(initialCapital: number, finalEquity: number): number {
  return (finalEquity - initialCapital) / initialCapital;
}

export function calculateAnnualizedReturn(totalReturn: number, days: number): number {
  return Math.pow(1 + totalReturn, 365 / days) - 1;
}

export function calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
  if (maxDrawdown === 0) return annualizedReturn > 0 ? Infinity : 0;
  return annualizedReturn / maxDrawdown;
}

export function calculateSortinoRatio(
  returns: number[],
  targetReturn: number = 0,
  riskFreeRate: number = 0.02
): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  
  // Calculate downside deviation (only negative returns)
  const downsideReturns = returns.filter(r => r < targetReturn);
  if (downsideReturns.length === 0) return Infinity;
  
  const downsideDeviation = Math.sqrt(
    downsideReturns.map(r => Math.pow(r - targetReturn, 2)).reduce((a, b) => a + b, 0) / 
    downsideReturns.length
  );
  
  if (downsideDeviation === 0) return Infinity;
  
  // Annualized Sortino ratio
  const excessReturn = avgReturn - (riskFreeRate / 252);
  return (excessReturn / downsideDeviation) * Math.sqrt(252);
}

export function calculateMonthlyReturns(
  equityCurve: { date: Date; value: number }[]
): { month: string; return: number }[] {
  if (equityCurve.length === 0) return [];
  
  const monthlyData = new Map<string, { start: number; end: number }>();
  
  for (const point of equityCurve) {
    const monthKey = `${point.date.getFullYear()}-${String(point.date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { start: point.value, end: point.value });
    } else {
      monthlyData.get(monthKey)!.end = point.value;
    }
  }
  
  return Array.from(monthlyData.entries()).map(([month, data]) => ({
    month,
    return: (data.end - data.start) / data.start
  }));
}

export function calculateAverageTrade(trades: BacktestTrade[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length;
}

export function calculateAverageWinningTrade(trades: BacktestTrade[]): number {
  const winningTrades = trades.filter(t => t.pnl > 0);
  if (winningTrades.length === 0) return 0;
  return winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
}

export function calculateAverageLosingTrade(trades: BacktestTrade[]): number {
  const losingTrades = trades.filter(t => t.pnl < 0);
  if (losingTrades.length === 0) return 0;
  return losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length;
}

export function calculateConsecutiveWins(trades: BacktestTrade[]): number {
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  
  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }
  
  return maxConsecutive;
}

export function calculateConsecutiveLosses(trades: BacktestTrade[]): number {
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  
  for (const trade of trades) {
    if (trade.pnl < 0) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }
  
  return maxConsecutive;
}
