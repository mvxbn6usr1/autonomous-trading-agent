import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, boolean, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Trading strategies configured by users
 */
export const strategies = mysqlTable("strategies", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(false).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).default("medium").notNull(),
  maxPositionSize: int("maxPositionSize").default(2).notNull(), // percentage
  dailyLossLimit: int("dailyLossLimit").default(10).notNull(), // percentage
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
}));

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = typeof strategies.$inferInsert;

/**
 * Market data - OHLCV candlesticks
 */
export const marketData = mysqlTable("marketData", {
  id: varchar("id", { length: 64 }).primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  open: int("open").notNull(), // stored as cents/smallest unit
  high: int("high").notNull(),
  low: int("low").notNull(),
  close: int("close").notNull(),
  volume: int("volume").notNull(),
  interval: varchar("interval", { length: 10 }).default("1m").notNull(), // 1m, 5m, 1h, 1d
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  symbolTimestampIdx: index("symbol_timestamp_idx").on(table.symbol, table.timestamp),
}));

export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = typeof marketData.$inferInsert;

/**
 * Trading positions
 */
export const positions = mysqlTable("positions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: mysqlEnum("side", ["long", "short"]).notNull(),
  quantity: int("quantity").notNull(),
  entryPrice: int("entryPrice").notNull(), // stored as cents
  currentPrice: int("currentPrice").notNull(),
  stopLoss: int("stopLoss"), // stored as cents
  takeProfit: int("takeProfit"),
  unrealizedPnL: int("unrealizedPnL").default(0).notNull(),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  openedAt: timestamp("openedAt").defaultNow(),
  closedAt: timestamp("closedAt"),
  closedPrice: int("closedPrice"),
  realizedPnL: int("realizedPnL"),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  statusIdx: index("status_idx").on(table.status),
}));

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;

/**
 * Trade orders
 */
export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  positionId: varchar("positionId", { length: 64 }),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: mysqlEnum("side", ["buy", "sell"]).notNull(),
  type: mysqlEnum("type", ["market", "limit"]).notNull(),
  quantity: int("quantity").notNull(),
  price: int("price"), // for limit orders, stored as cents
  filledQuantity: int("filledQuantity").default(0).notNull(),
  filledPrice: int("filledPrice"), // average fill price
  status: mysqlEnum("status", ["pending", "filled", "cancelled", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  filledAt: timestamp("filledAt"),
  cancelledAt: timestamp("cancelledAt"),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  statusIdx: index("status_idx").on(table.status),
}));

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Agent decisions and analysis
 */
export const agentDecisions = mysqlTable("agentDecisions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  agentType: mysqlEnum("agentType", [
    "fundamental",
    "sentiment",
    "technical",
    "bull_researcher",
    "bear_researcher",
    "trader",
    "risk_manager"
  ]).notNull(),
  recommendation: mysqlEnum("recommendation", ["strong_buy", "buy", "hold", "sell", "strong_sell"]).notNull(),
  confidence: int("confidence").notNull(), // 0-100
  reasoning: text("reasoning").notNull(),
  metrics: text("metrics"), // JSON string of metrics
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  createdAtIdx: index("createdAt_idx").on(table.createdAt),
}));

export type AgentDecision = typeof agentDecisions.$inferSelect;
export type InsertAgentDecision = typeof agentDecisions.$inferInsert;

/**
 * Audit trail for regulatory compliance
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  strategyId: varchar("strategyId", { length: 64 }),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  eventData: text("eventData").notNull(), // JSON string
  riskChecks: text("riskChecks"), // JSON string of risk validations
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  eventTypeIdx: index("eventType_idx").on(table.eventType),
  createdAtIdx: index("createdAt_idx").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Performance metrics tracking
 */
export const performanceMetrics = mysqlTable("performanceMetrics", {
  id: varchar("id", { length: 64 }).primaryKey(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  date: timestamp("date").notNull(),
  totalValue: int("totalValue").notNull(), // portfolio value in cents
  dailyReturn: int("dailyReturn").notNull(), // in basis points (1/100 of percent)
  sharpeRatio: int("sharpeRatio"), // multiplied by 100
  maxDrawdown: int("maxDrawdown"), // in basis points
  winRate: int("winRate"), // percentage 0-100
  totalTrades: int("totalTrades").default(0).notNull(),
  winningTrades: int("winningTrades").default(0).notNull(),
  losingTrades: int("losingTrades").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  dateIdx: index("date_idx").on(table.date),
}));

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = typeof performanceMetrics.$inferInsert;

/**
 * Risk alerts
 */
export const riskAlerts = mysqlTable("riskAlerts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  alertType: mysqlEnum("alertType", [
    "daily_loss_limit",
    "position_size_exceeded",
    "drawdown_limit",
    "circuit_breaker",
    "volatility_spike"
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON string
  acknowledged: boolean("acknowledged").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  acknowledgedAt: timestamp("acknowledgedAt"),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  acknowledgedIdx: index("acknowledged_idx").on(table.acknowledged),
}));

export type RiskAlert = typeof riskAlerts.$inferSelect;
export type InsertRiskAlert = typeof riskAlerts.$inferInsert;



/**
 * Portfolios - Multi-stock portfolio management
 */
export const portfolios = mysqlTable("portfolios", {
  id: varchar("id", { length: 64 }).primaryKey(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetAllocation: text("targetAllocation"), // JSON: { "AAPL": 20, "MSFT": 30, ... }
  rebalanceFrequency: mysqlEnum("rebalanceFrequency", ["daily", "weekly", "monthly"]).default("weekly"),
  maxStocks: int("maxStocks").default(10).notNull(),
  minCashPercent: int("minCashPercent").default(10).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
}));

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/**
 * Watchlists - Stocks being monitored for entry opportunities
 */
export const watchlists = mysqlTable("watchlists", {
  id: varchar("id", { length: 64 }).primaryKey(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow(),
  addedReason: text("addedReason"),
  targetEntryPrice: int("targetEntryPrice"), // stored as cents
  targetAllocation: int("targetAllocation"), // percentage
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium"),
  status: mysqlEnum("status", ["watching", "triggered", "entered", "rejected"]).default("watching"),
  lastAnalyzedAt: timestamp("lastAnalyzedAt"),
  analysisCount: int("analysisCount").default(0),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  symbolIdx: index("symbol_idx").on(table.symbol),
  statusIdx: index("status_idx").on(table.status),
}));

export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = typeof watchlists.$inferInsert;

/**
 * Market scans - Results from market-wide opportunity scans
 */
export const marketScans = mysqlTable("marketScans", {
  id: varchar("id", { length: 64 }).primaryKey(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  scanType: mysqlEnum("scanType", ["momentum", "value", "growth", "technical", "earnings"]).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  score: int("score").notNull(), // 0-100
  signals: text("signals"), // JSON array of signals
  metrics: text("metrics"), // JSON object of metrics
  scannedAt: timestamp("scannedAt").defaultNow(),
  expiresAt: timestamp("expiresAt"),
}, (table) => ({
  strategyIdIdx: index("strategyId_idx").on(table.strategyId),
  symbolIdx: index("symbol_idx").on(table.symbol),
  scoreIdx: index("score_idx").on(table.score),
  scannedAtIdx: index("scannedAt_idx").on(table.scannedAt),
}));

export type MarketScan = typeof marketScans.$inferSelect;
export type InsertMarketScan = typeof marketScans.$inferInsert;

/**
 * Backtests - historical strategy testing results
 */
export const backtests = mysqlTable("backtests", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  symbols: text("symbols").notNull(), // JSON array
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  initialCapital: decimal("initialCapital", { precision: 15, scale: 2 }).notNull(),
  finalEquity: decimal("finalEquity", { precision: 15, scale: 2 }),
  totalReturn: decimal("totalReturn", { precision: 10, scale: 6 }),
  sharpeRatio: decimal("sharpeRatio", { precision: 10, scale: 4 }),
  maxDrawdown: decimal("maxDrawdown", { precision: 10, scale: 6 }),
  winRate: decimal("winRate", { precision: 10, scale: 6 }),
  totalTrades: int("totalTrades"),
  profitFactor: decimal("profitFactor", { precision: 10, scale: 4 }),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  userIdIdx: index("backtest_userId_idx").on(table.userId),
  strategyIdIdx: index("backtest_strategyId_idx").on(table.strategyId),
}));

export type Backtest = typeof backtests.$inferSelect;
export type InsertBacktest = typeof backtests.$inferInsert;

/**
 * Backtest trades - individual trades from backtests
 */
export const backtestTrades = mysqlTable("backtestTrades", {
  id: varchar("id", { length: 64 }).primaryKey(),
  backtestId: varchar("backtestId", { length: 64 }).notNull(),
  date: timestamp("date").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  action: mysqlEnum("action", ["buy", "sell"]).notNull(),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 15, scale: 4 }).notNull(),
  commission: decimal("commission", { precision: 10, scale: 4 }).notNull(),
  pnl: decimal("pnl", { precision: 15, scale: 4 }).notNull(),
  entryPrice: decimal("entryPrice", { precision: 15, scale: 4 }),
  exitPrice: decimal("exitPrice", { precision: 15, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  backtestIdIdx: index("backtestTrade_backtestId_idx").on(table.backtestId),
}));

export type BacktestTrade = typeof backtestTrades.$inferSelect;
export type InsertBacktestTrade = typeof backtestTrades.$inferInsert;

/**
 * Backtest equity curve - portfolio value over time
 */
export const backtestEquityCurve = mysqlTable("backtestEquityCurve", {
  id: varchar("id", { length: 64 }).primaryKey(),
  backtestId: varchar("backtestId", { length: 64 }).notNull(),
  date: timestamp("date").notNull(),
  value: decimal("value", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  backtestIdIdx: index("backtestEquity_backtestId_idx").on(table.backtestId),
}));

export type BacktestEquityCurve = typeof backtestEquityCurve.$inferSelect;
export type InsertBacktestEquityCurve = typeof backtestEquityCurve.$inferInsert;

/**
 * Portfolio snapshots - Historical portfolio state for performance tracking
 */
export const portfolioSnapshots = mysqlTable("portfolioSnapshots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  portfolioId: varchar("portfolioId", { length: 64 }).notNull(),
  totalValue: int("totalValue").notNull(), // stored as cents
  cashValue: int("cashValue").notNull(),
  positionsValue: int("positionsValue").notNull(),
  unrealizedPnL: int("unrealizedPnL").notNull(),
  realizedPnL: int("realizedPnL").notNull(),
  holdings: text("holdings"), // JSON: [{ symbol, quantity, value, allocation }]
  snapshotAt: timestamp("snapshotAt").defaultNow(),
}, (table) => ({
  portfolioIdIdx: index("portfolioId_idx").on(table.portfolioId),
  snapshotAtIdx: index("snapshotAt_idx").on(table.snapshotAt),
}));

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

