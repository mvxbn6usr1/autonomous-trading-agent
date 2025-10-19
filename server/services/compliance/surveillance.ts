// Market abuse surveillance and detection system
// Detects wash trading, layering, spoofing, and other manipulative practices

import { getDb } from '../../db';
import { orders, auditLogs, InsertAuditLog } from '../../../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface Alert {
  type: 'wash_trading' | 'layering' | 'spoofing' | 'excessive_velocity' | 'price_manipulation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  trades?: string[];
  orders?: string[];
  stats?: any;
}

export interface SurveillanceReport {
  userId: string;
  strategyId: string;
  timestamp: Date;
  alerts: Alert[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export class MarketAbuseSurveillance {
  /**
   * Detect potential wash trading (offsetting buy/sell to create artificial volume)
   */
  async detectWashTrading(
    strategyId: string,
    timeWindowMs: number = 3600000 // 1 hour
  ): Promise<Alert[]> {
    const db = await getDb();
    if (!db) return [];
    
    const alerts: Alert[] = [];
    const cutoffTime = new Date(Date.now() - timeWindowMs);

    // Get recent filled trades
    const trades = await db.query.orders.findMany({
      where: and(
        eq(orders.strategyId, strategyId),
        eq(orders.status, 'filled'),
        gte(orders.createdAt, cutoffTime)
      ),
      orderBy: [orders.createdAt],
    });

    // Group by symbol
    const bySymbol = new Map<string, typeof trades>();
    for (const trade of trades) {
      if (!bySymbol.has(trade.symbol)) {
        bySymbol.set(trade.symbol, []);
      }
      bySymbol.get(trade.symbol)!.push(trade);
    }

    // Check for offsetting trades
    for (const [symbol, symbolTrades] of bySymbol) {
      const buys = symbolTrades.filter(t => t.side === 'buy');
      const sells = symbolTrades.filter(t => t.side === 'sell');

      for (const buy of buys) {
        for (const sell of sells) {
          const timeDiff = Math.abs(
            sell.createdAt.getTime() - buy.createdAt.getTime()
          );
          const buyPrice = parseFloat(buy.filledPrice || '0');
          const sellPrice = parseFloat(sell.filledPrice || '0');
          const priceDiff = Math.abs(sellPrice - buyPrice) / buyPrice;

          // Suspicion: offsetting trades within 1 hour at similar prices (< 1% difference)
          if (timeDiff < 3600000 && priceDiff < 0.01 && buy.quantity === sell.quantity) {
            alerts.push({
              type: 'wash_trading',
              severity: 'high',
              description: `Potential wash trading detected in ${symbol}: Buy/sell at similar price (${buyPrice.toFixed(2)} vs ${sellPrice.toFixed(2)}) within ${Math.floor(timeDiff / 60000)} minutes`,
              timestamp: new Date(),
              trades: [buy.id, sell.id],
            });
          }
        }
      }
    }

    return alerts;
  }

  /**
   * Detect layering/spoofing (placing large orders then canceling after market moves)
   */
  async detectLayering(
    strategyId: string,
    timeWindowMs: number = 300000 // 5 minutes
  ): Promise<Alert[]> {
    const db = await getDb();
    if (!db) return [];
    
    const alerts: Alert[] = [];
    const cutoffTime = new Date(Date.now() - timeWindowMs);

    const recentOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.strategyId, strategyId),
        gte(orders.createdAt, cutoffTime)
      ),
    });

    const cancelled = recentOrders.filter(o => o.status === 'cancelled');
    const filled = recentOrders.filter(o => o.status === 'filled');

    // High cancellation rate + some fills = potential layering
    if (cancelled.length > 5 && filled.length > 0) {
      const cancellationRate = cancelled.length / recentOrders.length;

      if (cancellationRate > 0.7) {
        // >70% cancellation rate
        alerts.push({
          type: 'layering',
          severity: 'medium',
          description: `High order cancellation rate (${(cancellationRate * 100).toFixed(1)}%) with filled orders detected`,
          timestamp: new Date(),
          stats: {
            cancelled: cancelled.length,
            filled: filled.length,
            cancellationRate,
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Detect excessive trading velocity (abnormal trading frequency)
   */
  async detectExcessiveVelocity(
    strategyId: string,
    timeWindowMs: number = 60000 // 1 minute
  ): Promise<Alert[]> {
    const db = await getDb();
    if (!db) return [];
    
    const alerts: Alert[] = [];
    const cutoffTime = new Date(Date.now() - timeWindowMs);

    const recentTrades = await db.query.orders.findMany({
      where: and(
        eq(orders.strategyId, strategyId),
        eq(orders.status, 'filled'),
        gte(orders.createdAt, cutoffTime)
      ),
    });

    // Threshold: more than 50 trades per minute is suspicious
    if (recentTrades.length > 50) {
      alerts.push({
        type: 'excessive_velocity',
        severity: 'medium',
        description: `Abnormally high trading velocity: ${recentTrades.length} trades in ${timeWindowMs / 1000} seconds`,
        timestamp: new Date(),
        stats: {
          tradesPerMinute: recentTrades.length / (timeWindowMs / 60000),
        },
      });
    }

    return alerts;
  }

  /**
   * Detect spoofing (placing non-bona fide orders to manipulate price)
   */
  async detectSpoofing(
    strategyId: string,
    timeWindowMs: number = 600000 // 10 minutes
  ): Promise<Alert[]> {
    const db = await getDb();
    if (!db) return [];
    
    const alerts: Alert[] = [];
    const cutoffTime = new Date(Date.now() - timeWindowMs);

    const recentOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.strategyId, strategyId),
        gte(orders.createdAt, cutoffTime)
      ),
      orderBy: [orders.createdAt],
    });

    // Look for pattern: large order placed → cancelled quickly → opposite side filled
    const bySymbol = new Map<string, typeof recentOrders>();
    for (const order of recentOrders) {
      if (!bySymbol.has(order.symbol)) {
        bySymbol.set(order.symbol, []);
      }
      bySymbol.get(order.symbol)!.push(order);
    }

    for (const [symbol, symbolOrders] of bySymbol) {
      for (let i = 0; i < symbolOrders.length - 1; i++) {
        const order1 = symbolOrders[i];
        const order2 = symbolOrders[i + 1];

        // Check for cancelled large order followed by opposite side fill
        if (
          order1.status === 'cancelled' &&
          order2.status === 'filled' &&
          order1.side !== order2.side &&
          order1.quantity > order2.quantity * 2 // Cancelled order was 2x larger
        ) {
          const timeDiff = order2.createdAt.getTime() - order1.createdAt.getTime();
          
          if (timeDiff < 120000) {
            // Within 2 minutes
            alerts.push({
              type: 'spoofing',
              severity: 'high',
              description: `Potential spoofing in ${symbol}: Large ${order1.side} order cancelled, followed by opposite ${order2.side} fill`,
              timestamp: new Date(),
              orders: [order1.id, order2.id],
            });
          }
        }
      }
    }

    return alerts;
  }

  /**
   * Master surveillance check - runs all detection algorithms
   */
  async runSurveillance(userId: string, strategyId: string): Promise<SurveillanceReport> {
    const [washTrading, layering, velocity, spoofing] = await Promise.all([
      this.detectWashTrading(strategyId),
      this.detectLayering(strategyId),
      this.detectExcessiveVelocity(strategyId),
      this.detectSpoofing(strategyId),
    ]);

    const allAlerts = [...washTrading, ...layering, ...velocity, ...spoofing];

    // Count by severity
    const summary = {
      total: allAlerts.length,
      critical: allAlerts.filter(a => a.severity === 'critical').length,
      high: allAlerts.filter(a => a.severity === 'high').length,
      medium: allAlerts.filter(a => a.severity === 'medium').length,
      low: allAlerts.filter(a => a.severity === 'low').length,
    };

    // Auto-report critical/high severity alerts
    const highSeverity = allAlerts.filter(a => a.severity === 'high' || a.severity === 'critical');
    if (highSeverity.length > 0) {
      await this.reportToCompliance(userId, strategyId, highSeverity);
    }

    return {
      userId,
      strategyId,
      timestamp: new Date(),
      alerts: allAlerts,
      summary,
    };
  }

  /**
   * Report suspicious activity to compliance log
   */
  private async reportToCompliance(
    userId: string,
    strategyId: string,
    alerts: Alert[]
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;
    
    for (const alert of alerts) {
      const auditLog: InsertAuditLog = {
        id: nanoid(),
        userId,
        strategyId,
        eventType: 'market_abuse_alert',
        eventData: JSON.stringify({
          alertType: alert.type,
          severity: alert.severity,
          description: alert.description,
          timestamp: alert.timestamp.toISOString(),
          trades: alert.trades,
          orders: alert.orders,
          stats: alert.stats,
        }),
      };

      await db.insert(auditLogs).values(auditLog);
    }

    console.warn(
      `[Surveillance] Reported ${alerts.length} high-severity alerts for strategy ${strategyId}`
    );
  }

  /**
   * Get surveillance history
   */
  async getSurveillanceHistory(
    strategyId: string,
    days: number = 30
  ): Promise<Alert[]> {
    const db = await getDb();
    if (!db) return [];
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const auditRecords = await db.query.auditLogs.findMany({
      where: and(
        eq(auditLogs.strategyId, strategyId),
        eq(auditLogs.eventType, 'market_abuse_alert'),
        gte(auditLogs.createdAt, cutoffDate)
      ),
      orderBy: [auditLogs.createdAt],
    });

    return auditRecords.map(record => {
      const data = JSON.parse(record.eventData || '{}');
      return {
        type: data.alertType,
        severity: data.severity,
        description: data.description,
        timestamp: new Date(data.timestamp),
        trades: data.trades,
        orders: data.orders,
        stats: data.stats,
      };
    });
  }
}

// Export singleton instance
export const surveillanceService = new MarketAbuseSurveillance();
