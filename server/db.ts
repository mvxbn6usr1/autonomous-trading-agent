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

