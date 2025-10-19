import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  strategies,
  InsertStrategy,
  Strategy,
  marketData,
  InsertMarketData,
  MarketData,
  positions,
  InsertPosition,
  Position,
  orders,
  InsertOrder,
  Order,
  agentDecisions,
  InsertAgentDecision,
  AgentDecision,
  auditLogs,
  InsertAuditLog,
  AuditLog,
  performanceMetrics,
  InsertPerformanceMetric,
  PerformanceMetric,
  riskAlerts,
  InsertRiskAlert,
  RiskAlert,
  portfolios,
  InsertPortfolio,
  Portfolio,
  watchlists,
  InsertWatchlist,
  Watchlist,
  marketScans,
  InsertMarketScan,
  MarketScan,
  portfolioSnapshots,
  InsertPortfolioSnapshot,
  PortfolioSnapshot,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============= USER OPERATIONS =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { id: user.id };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = "admin";
        values.role = "admin";
        updateSet.role = "admin";
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= STRATEGY OPERATIONS =============

export async function createStrategy(strategy: InsertStrategy): Promise<Strategy> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(strategies).values(strategy);
  const result = await db.select().from(strategies).where(eq(strategies.id, strategy.id!)).limit(1);
  return result[0];
}

export async function getUserStrategies(userId: string): Promise<Strategy[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(strategies).where(eq(strategies.userId, userId)).orderBy(desc(strategies.createdAt));
}

export async function getActiveStrategies(): Promise<Strategy[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(strategies).where(eq(strategies.isActive, true));
}

export async function getStrategy(id: string): Promise<Strategy | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(strategies).where(eq(strategies.id, id)).limit(1);
  return result[0];
}

export async function updateStrategy(id: string, updates: Partial<Strategy>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(strategies).set({ ...updates, updatedAt: new Date() }).where(eq(strategies.id, id));
}

export async function deleteStrategy(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(strategies).where(eq(strategies.id, id));
}

// ============= MARKET DATA OPERATIONS =============

export async function insertMarketData(data: InsertMarketData): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(marketData).values(data);
}

export async function getLatestMarketData(symbol: string, interval: string = "1m"): Promise<MarketData | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(marketData)
    .where(and(eq(marketData.symbol, symbol), eq(marketData.interval, interval)))
    .orderBy(desc(marketData.timestamp))
    .limit(1);

  return result[0];
}

export async function getMarketDataRange(
  symbol: string,
  startTime: Date,
  endTime: Date,
  interval: string = "1m"
): Promise<MarketData[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(marketData)
    .where(
      and(
        eq(marketData.symbol, symbol),
        eq(marketData.interval, interval),
        gte(marketData.timestamp, startTime),
        lte(marketData.timestamp, endTime)
      )
    )
    .orderBy(marketData.timestamp);
}

// ============= POSITION OPERATIONS =============

export async function createPosition(position: InsertPosition): Promise<Position> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(positions).values(position);
  const result = await db.select().from(positions).where(eq(positions.id, position.id!)).limit(1);
  return result[0];
}

export async function getOpenPositions(strategyId: string): Promise<Position[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(positions)
    .where(and(eq(positions.strategyId, strategyId), eq(positions.status, "open")))
    .orderBy(desc(positions.openedAt));
}

export async function getUserPositions(userId: string): Promise<Position[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(positions).where(eq(positions.userId, userId)).orderBy(desc(positions.openedAt));
}

export async function updatePosition(id: string, updates: Partial<Position>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(positions).set(updates).where(eq(positions.id, id));
}

export async function closePosition(id: string, closedPrice: number, realizedPnL: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(positions)
    .set({
      status: "closed",
      closedAt: new Date(),
      closedPrice,
      realizedPnL,
    })
    .where(eq(positions.id, id));
}

// ============= ORDER OPERATIONS =============

export async function createOrder(order: InsertOrder): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(orders).values(order);
  const result = await db.select().from(orders).where(eq(orders.id, order.id!)).limit(1);
  return result[0];
}

export async function getStrategyOrders(strategyId: string): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(orders).where(eq(orders.strategyId, strategyId)).orderBy(desc(orders.createdAt));
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(orders).set(updates).where(eq(orders.id, id));
}

// ============= AGENT DECISION OPERATIONS =============

export async function createAgentDecision(decision: InsertAgentDecision): Promise<AgentDecision> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(agentDecisions).values(decision);
  const result = await db.select().from(agentDecisions).where(eq(agentDecisions.id, decision.id!)).limit(1);
  return result[0];
}

export async function getStrategyDecisions(strategyId: string, limit: number = 50): Promise<AgentDecision[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(agentDecisions)
    .where(eq(agentDecisions.strategyId, strategyId))
    .orderBy(desc(agentDecisions.createdAt))
    .limit(limit);
}

export async function getRecentDecisionsByAgent(
  strategyId: string,
  agentType: string,
  limit: number = 10
): Promise<AgentDecision[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(agentDecisions)
    .where(and(eq(agentDecisions.strategyId, strategyId), eq(agentDecisions.agentType, agentType as any)))
    .orderBy(desc(agentDecisions.createdAt))
    .limit(limit);
}

// ============= AUDIT LOG OPERATIONS =============

export async function createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(auditLogs).values(log);
  const result = await db.select().from(auditLogs).where(eq(auditLogs.id, log.id!)).limit(1);
  return result[0];
}

export async function getUserAuditLogs(userId: string, limit: number = 100): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function getStrategyAuditLogs(strategyId: string, limit: number = 100): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.strategyId, strategyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ============= PERFORMANCE METRICS OPERATIONS =============

export async function createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(performanceMetrics).values(metric);
  const result = await db.select().from(performanceMetrics).where(eq(performanceMetrics.id, metric.id!)).limit(1);
  return result[0];
}

export async function getStrategyPerformance(strategyId: string, days: number = 30): Promise<PerformanceMetric[]> {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return db
    .select()
    .from(performanceMetrics)
    .where(and(eq(performanceMetrics.strategyId, strategyId), gte(performanceMetrics.date, startDate)))
    .orderBy(performanceMetrics.date);
}

// ============= RISK ALERT OPERATIONS =============

export async function createRiskAlert(alert: InsertRiskAlert): Promise<RiskAlert> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(riskAlerts).values(alert);
  const result = await db.select().from(riskAlerts).where(eq(riskAlerts.id, alert.id!)).limit(1);
  return result[0];
}

export async function getUnacknowledgedAlerts(userId: string): Promise<RiskAlert[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(riskAlerts)
    .where(and(eq(riskAlerts.userId, userId), eq(riskAlerts.acknowledged, false)))
    .orderBy(desc(riskAlerts.createdAt));
}

export async function acknowledgeAlert(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(riskAlerts)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
    })
    .where(eq(riskAlerts.id, id));
}

export async function getStrategyAlerts(strategyId: string, limit: number = 50): Promise<RiskAlert[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(riskAlerts)
    .where(eq(riskAlerts.strategyId, strategyId))
    .orderBy(desc(riskAlerts.createdAt))
    .limit(limit);
}



// ============= PORTFOLIO OPERATIONS =============

export async function createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(portfolios).values(portfolio);
  const result = await db.select().from(portfolios).where(eq(portfolios.id, portfolio.id!)).limit(1);
  return result[0];
}

export async function getPortfolioByStrategy(strategyId: string): Promise<Portfolio | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(portfolios).where(eq(portfolios.strategyId, strategyId)).limit(1);
  return result[0] || null;
}

export async function updatePortfolio(id: string, updates: Partial<InsertPortfolio>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(portfolios).set({ ...updates, updatedAt: new Date() }).where(eq(portfolios.id, id));
}

// ============= WATCHLIST OPERATIONS =============

export async function addToWatchlist(item: InsertWatchlist): Promise<Watchlist> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(watchlists).values(item);
  const result = await db.select().from(watchlists).where(eq(watchlists.id, item.id!)).limit(1);
  return result[0];
}

export async function getWatchlist(strategyId: string, status?: string): Promise<Watchlist[]> {
  const db = await getDb();
  if (!db) return [];

  if (status) {
    return db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.strategyId, strategyId), eq(watchlists.status, status as any)))
      .orderBy(desc(watchlists.addedAt));
  }

  return db.select().from(watchlists).where(eq(watchlists.strategyId, strategyId)).orderBy(desc(watchlists.addedAt));
}

export async function updateWatchlistItem(id: string, updates: Partial<InsertWatchlist>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(watchlists).set(updates).where(eq(watchlists.id, id));
}

export async function removeFromWatchlist(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(watchlists).where(eq(watchlists.id, id));
}

export async function getWatchlistBySymbol(strategyId: string, symbol: string): Promise<Watchlist | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.strategyId, strategyId), eq(watchlists.symbol, symbol)))
    .limit(1);

  return result[0] || null;
}

// ============= MARKET SCAN OPERATIONS =============

export async function saveMarketScan(scan: InsertMarketScan): Promise<MarketScan> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(marketScans).values(scan);
  const result = await db.select().from(marketScans).where(eq(marketScans.id, scan.id!)).limit(1);
  return result[0];
}

export async function getRecentScans(strategyId: string, scanType?: string, limit: number = 50): Promise<MarketScan[]> {
  const db = await getDb();
  if (!db) return [];

  if (scanType) {
    return db
      .select()
      .from(marketScans)
      .where(and(eq(marketScans.strategyId, strategyId), eq(marketScans.scanType, scanType as any)))
      .orderBy(desc(marketScans.score), desc(marketScans.scannedAt))
      .limit(limit);
  }

  return db
    .select()
    .from(marketScans)
    .where(eq(marketScans.strategyId, strategyId))
    .orderBy(desc(marketScans.score), desc(marketScans.scannedAt))
    .limit(limit);
}

export async function getTopScans(strategyId: string, minScore: number = 70, limit: number = 20): Promise<MarketScan[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(marketScans)
    .where(and(eq(marketScans.strategyId, strategyId), gte(marketScans.score, minScore)))
    .orderBy(desc(marketScans.score))
    .limit(limit);
}

// ============= PORTFOLIO SNAPSHOT OPERATIONS =============

export async function savePortfolioSnapshot(snapshot: InsertPortfolioSnapshot): Promise<PortfolioSnapshot> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(portfolioSnapshots).values(snapshot);
  const result = await db.select().from(portfolioSnapshots).where(eq(portfolioSnapshots.id, snapshot.id!)).limit(1);
  return result[0];
}

export async function getPortfolioSnapshots(
  portfolioId: string,
  startDate?: Date,
  endDate?: Date,
  limit: number = 100
): Promise<PortfolioSnapshot[]> {
  const db = await getDb();
  if (!db) return [];

  if (startDate && endDate) {
    return db
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.portfolioId, portfolioId),
          gte(portfolioSnapshots.snapshotAt, startDate),
          lte(portfolioSnapshots.snapshotAt, endDate)
        )
      )
      .orderBy(desc(portfolioSnapshots.snapshotAt))
      .limit(limit);
  }

  return db
    .select()
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.portfolioId, portfolioId))
    .orderBy(desc(portfolioSnapshots.snapshotAt))
    .limit(limit);
}

export async function getLatestPortfolioSnapshot(portfolioId: string): Promise<PortfolioSnapshot | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.portfolioId, portfolioId))
    .orderBy(desc(portfolioSnapshots.snapshotAt))
    .limit(1);

  return result[0] || null;
}

