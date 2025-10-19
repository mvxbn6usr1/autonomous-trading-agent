// Backtesting type definitions

export interface BacktestConfig {
  strategyId: string;
  symbols: string[];
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commission: number; // per trade
}

export interface BacktestTrade {
  date: Date;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  pnl: number;
  entryPrice?: number;
  exitPrice?: number;
}

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  trades: BacktestTrade[];
  equityCurve: { date: Date; value: number }[];
  dailyReturns: number[];
  monthlyReturns: { month: string; return: number }[];
}

export interface Portfolio {
  cash: number;
  positions: Map<string, Position>;
  equity: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryDate: Date;
  currentPrice: number;
  unrealizedPnL: number;
}

export interface MarketDataBar {
  date: Date;
  prices: Record<string, number>;
  indicators: Record<string, any>;
  volume: Record<string, number>;
}

export interface BacktestProgress {
  currentDate: Date;
  progress: number; // 0-100
  tradesExecuted: number;
  currentEquity: number;
}
