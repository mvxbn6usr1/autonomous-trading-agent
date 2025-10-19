import { getDb } from "../db";
import { auditLogs, riskAlerts } from "../../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";

/**
 * Compliance and Regulatory Service
 * Handles audit logging, compliance reporting, and regulatory requirements
 */

export interface AuditLogEntry {
  strategyId: string;
  userId: string;
  eventType: string;
  eventData: Record<string, any>;
  riskChecks?: Record<string, any>;
}

export interface ComplianceReport {
  strategyId: string;
  period: { start: Date; end: Date };
  totalTrades: number;
  riskViolations: number;
  circuitBreakerActivations: number;
  averagePositionSize: number;
  maxDrawdown: number;
  complianceScore: number;
  recommendations: string[];
}

/**
 * Log an audit event with full context
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      strategyId: entry.strategyId,
      userId: entry.userId,
      eventType: entry.eventType,
      eventData: JSON.stringify(entry.eventData),
      riskChecks: entry.riskChecks ? JSON.stringify(entry.riskChecks) : null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[Compliance] Failed to log audit event:", error);
  }
}

/**
 * Generate compliance report for a strategy
 */
export async function generateComplianceReport(
  strategyId: string,
  startDate: Date,
  endDate: Date
): Promise<ComplianceReport> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all audit logs for the period
  const logs = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.strategyId, strategyId), gte(auditLogs.createdAt, startDate)))
    .orderBy(desc(auditLogs.createdAt));

  // Get all risk alerts for the period
  const alerts = await db
    .select()
    .from(riskAlerts)
    .where(and(eq(riskAlerts.strategyId, strategyId), gte(riskAlerts.createdAt, startDate)));

  // Calculate metrics
  const tradeEvents = logs.filter((log) => log.eventType === "trade_executed");
  const riskViolations = alerts.filter((alert) => alert.severity === "high" || alert.severity === "critical").length;
  const circuitBreakerEvents = logs.filter((log) => log.eventType === "circuit_breaker_triggered").length;

  // Calculate average position size
  let totalPositionSize = 0;
  let positionCount = 0;
  for (const log of tradeEvents) {
    const data = log.eventData ? JSON.parse(log.eventData) : {};
    if (data.positionSize) {
      totalPositionSize += data.positionSize;
      positionCount++;
    }
  }
  const averagePositionSize = positionCount > 0 ? totalPositionSize / positionCount : 0;

  // Calculate compliance score (0-100)
  let complianceScore = 100;
  complianceScore -= riskViolations * 5; // -5 points per violation
  complianceScore -= circuitBreakerEvents * 10; // -10 points per circuit breaker
  complianceScore = Math.max(0, Math.min(100, complianceScore));

  // Generate recommendations
  const recommendations: string[] = [];
  if (riskViolations > 5) {
    recommendations.push("High number of risk violations detected. Review risk parameters.");
  }
  if (circuitBreakerEvents > 0) {
    recommendations.push("Circuit breaker activated. Consider reducing position sizes or daily loss limits.");
  }
  if (averagePositionSize > 5) {
    recommendations.push("Average position size exceeds recommended threshold. Consider reducing exposure.");
  }
  if (complianceScore < 70) {
    recommendations.push("Compliance score below acceptable threshold. Immediate review required.");
  }

  return {
    strategyId,
    period: { start: startDate, end: endDate },
    totalTrades: tradeEvents.length,
    riskViolations,
    circuitBreakerActivations: circuitBreakerEvents,
    averagePositionSize,
    maxDrawdown: 0, // Would be calculated from performance metrics
    complianceScore,
    recommendations,
  };
}

/**
 * Check if strategy meets regulatory requirements
 */
export async function checkRegulatoryCompliance(strategyId: string): Promise<{
  compliant: boolean;
  issues: string[];
}> {
  const db = await getDb();
  if (!db) {
    return { compliant: false, issues: ["Database not available"] };
  }

  const issues: string[] = [];

  // Check for unacknowledged critical alerts
  const criticalAlerts = await db
    .select()
    .from(riskAlerts)
    .where(and(eq(riskAlerts.strategyId, strategyId), eq(riskAlerts.severity, "critical"), eq(riskAlerts.acknowledged, false)));

  if (criticalAlerts.length > 0) {
    issues.push(`${criticalAlerts.length} unacknowledged critical alerts`);
  }

  // Check audit log completeness (should have logs from last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.strategyId, strategyId), gte(auditLogs.createdAt, yesterday)));

  if (recentLogs.length === 0) {
    issues.push("No audit logs in the last 24 hours");
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

/**
 * Export audit trail for regulatory review
 */
export async function exportAuditTrail(
  strategyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  logs: any[];
  summary: {
    totalEvents: number;
    eventTypes: Record<string, number>;
    riskChecksPerformed: number;
  };
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const logs = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.strategyId, strategyId), gte(auditLogs.createdAt, startDate)))
    .orderBy(desc(auditLogs.createdAt));

  // Calculate summary statistics
  const eventTypes: Record<string, number> = {};
  let riskChecksPerformed = 0;

  for (const log of logs) {
    eventTypes[log.eventType] = (eventTypes[log.eventType] || 0) + 1;
    if (log.riskChecks) {
      riskChecksPerformed++;
    }
  }

  return {
    logs: logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      eventType: log.eventType,
      eventData: log.eventData ? JSON.parse(log.eventData) : {},
      riskChecks: log.riskChecks ? JSON.parse(log.riskChecks) : null,
    })),
    summary: {
      totalEvents: logs.length,
      eventTypes,
      riskChecksPerformed,
    },
  };
}

