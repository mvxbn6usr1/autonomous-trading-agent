// Pattern Day Trader (PDT) tracking and compliance service
// SEC Rule requires $25,000 minimum for accounts with 4+ day trades in 5 business days

import { db } from '../../db';
import { orders, auditLogs, InsertAuditLog } from '../../../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getBroker } from '../brokers';
import { nanoid } from 'nanoid';

export interface PDTStatus {
  isDayTrader: boolean;
  dayTradesLast5Days: number;
  daysUntilReset: number;
  accountValue: number;
  pdtMinimum: number;
  canDayTrade: boolean;
  warning?: string;
  nextResetDate: Date;
}

export interface DayTrade {
  date: Date;
  symbol: string;
  buyOrder: any;
  sellOrder: any;
}

export class PatternDayTraderService {
  private readonly PDT_MINIMUM = 25000; // $25,000 FINRA requirement
  private readonly PDT_THRESHOLD = 4; // 4 day trades triggers PDT status
  private readonly ROLLING_DAYS = 5; // 5 business days

  /**
   * Check current PDT status for a strategy
   */
  async checkPDTStatus(userId: string, strategyId: string): Promise<PDTStatus> {
    // Get account value from broker
    const broker = getBroker();
    const account = await broker.getAccount();
    const accountValue = parseFloat(account.portfolioValue || '0');

    // Get day trades in last 5 business days
    const dayTrades = await this.getDayTrades(strategyId, this.ROLLING_DAYS);
    const dayTradeCount = dayTrades.length;

    // Determine PDT status
    const isDayTrader = dayTradeCount >= this.PDT_THRESHOLD;
    const canDayTrade = accountValue >= this.PDT_MINIMUM;

    // Calculate days until reset (oldest trade drops off)
    const nextResetDate = this.calculateNextResetDate(dayTrades);
    const daysUntilReset = this.calculateDaysUntilReset(nextResetDate);

    // Generate warning message
    let warning: string | undefined;
    if (dayTradeCount === this.PDT_THRESHOLD - 1) {
      warning = `⚠️ One more day trade will classify you as a Pattern Day Trader. ${
        canDayTrade ? 'Your account meets the $25k minimum.' : 'Your account is below the $25k minimum!'
      }`;
    } else if (isDayTrader && !canDayTrade) {
      warning = `🚫 Pattern Day Trader restriction active. Account must maintain $25,000 minimum. Current: $${accountValue.toLocaleString()}`;
    } else if (dayTradeCount > 0) {
      warning = `📊 ${dayTradeCount} day trade${dayTradeCount > 1 ? 's' : ''} in last 5 days. ${this.PDT_THRESHOLD - dayTradeCount} remaining before PDT status.`;
    }

    return {
      isDayTrader,
      dayTradesLast5Days: dayTradeCount,
      daysUntilReset,
      accountValue,
      pdtMinimum: this.PDT_MINIMUM,
      canDayTrade,
      warning,
      nextResetDate,
    };
  }

  /**
   * Validate if a sell order would trigger a day trade violation
   */
  async validateDayTrade(
    userId: string,
    strategyId: string,
    symbol: string
  ): Promise<{ allowed: boolean; reason?: string; status: PDTStatus }> {
    // Check if position was opened today
    const positionOpenedToday = await this.wasPositionOpenedToday(strategyId, symbol);
    
    if (!positionOpenedToday) {
      // Not a day trade - safe to proceed
      const status = await this.checkPDTStatus(userId, strategyId);
      return { allowed: true, status };
    }

    // This would be a day trade - check PDT status
    const status = await this.checkPDTStatus(userId, strategyId);

    // If account is above $25k, day trading is allowed
    if (status.canDayTrade) {
      return { allowed: true, status };
    }

    // Check if we're at or above the threshold
    if (status.dayTradesLast5Days >= this.PDT_THRESHOLD - 1) {
      // Would violate PDT rule
      await this.createPDTAlert(userId, strategyId, symbol);
      
      return {
        allowed: false,
        reason: `PDT violation: ${status.dayTradesLast5Days + 1} day trades would exceed limit. Account minimum: $${this.PDT_MINIMUM.toLocaleString()}`,
        status,
      };
    }

    // Under threshold and would still be under after this trade
    return { allowed: true, status };
  }

  /**
   * Get all day trades in the last N business days
   */
  private async getDayTrades(strategyId: string, businessDays: number): Promise<DayTrade[]> {
    const cutoffDate = this.getBusinessDaysAgo(businessDays);

    // Get all orders since cutoff date
    const allOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.strategyId, strategyId),
        gte(orders.createdAt, cutoffDate)
      ),
      orderBy: [orders.createdAt],
    });

    // Group by date and symbol
    const dayTrades: DayTrade[] = [];
    const tradingDays = this.groupByTradingDay(allOrders);

    for (const [dateKey, dayOrders] of tradingDays) {
      const symbolGroups = this.groupBySymbol(dayOrders);

      for (const [symbol, symbolOrders] of symbolGroups) {
        // Check if there's both a buy and sell on the same day
        const buyOrders = symbolOrders.filter(o => o.side === 'buy' && o.status === 'filled');
        const sellOrders = symbolOrders.filter(o => o.side === 'sell' && o.status === 'filled');

        // If we bought and sold the same symbol on the same day, it's a day trade
        if (buyOrders.length > 0 && sellOrders.length > 0) {
          dayTrades.push({
            date: new Date(dateKey),
            symbol,
            buyOrder: buyOrders[0],
            sellOrder: sellOrders[0],
          });
        }
      }
    }

    return dayTrades;
  }

  /**
   * Check if a position was opened today
   */
  private async wasPositionOpenedToday(strategyId: string, symbol: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buyOrdersToday = await db.query.orders.findMany({
      where: and(
        eq(orders.strategyId, strategyId),
        eq(orders.symbol, symbol),
        eq(orders.side, 'buy'),
        eq(orders.status, 'filled'),
        gte(orders.createdAt, today)
      ),
    });

    return buyOrdersToday.length > 0;
  }

  /**
   * Create a PDT violation alert
   */
  private async createPDTAlert(userId: string, strategyId: string, symbol: string): Promise<void> {
    const auditLog: InsertAuditLog = {
      id: nanoid(),
      userId,
      strategyId,
      eventType: 'pdt_violation',
      eventData: JSON.stringify({
        symbol,
        message: 'Pattern Day Trader violation prevented',
        timestamp: new Date().toISOString(),
      }),
    };

    await db.insert(auditLogs).values(auditLog);

    console.error(`[PDT] Violation prevented for ${symbol} in strategy ${strategyId}`);
  }

  /**
   * Get date N business days ago
   */
  private getBusinessDaysAgo(days: number): Date {
    const date = new Date();
    let businessDays = 0;

    while (businessDays < days) {
      date.setDate(date.getDate() - 1);
      const dayOfWeek = date.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++;
      }
    }

    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Group orders by trading day
   */
  private groupByTradingDay(orders: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(order);
    }

    return groups;
  }

  /**
   * Group orders by symbol
   */
  private groupBySymbol(orders: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const order of orders) {
      if (!groups.has(order.symbol)) {
        groups.set(order.symbol, []);
      }
      groups.get(order.symbol)!.push(order);
    }

    return groups;
  }

  /**
   * Calculate next reset date (when oldest day trade drops off)
   */
  private calculateNextResetDate(dayTrades: DayTrade[]): Date {
    if (dayTrades.length === 0) {
      return new Date();
    }

    // Sort by date
    const sorted = [...dayTrades].sort((a, b) => a.date.getTime() - b.date.getTime());
    const oldestTrade = sorted[0];

    // Find the 6th business day after the oldest trade (when it drops off)
    const resetDate = new Date(oldestTrade.date);
    let businessDays = 0;

    while (businessDays < this.ROLLING_DAYS + 1) {
      resetDate.setDate(resetDate.getDate() + 1);
      const dayOfWeek = resetDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++;
      }
    }

    return resetDate;
  }

  /**
   * Calculate days until reset
   */
  private calculateDaysUntilReset(resetDate: Date): number {
    const now = new Date();
    const diffTime = resetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Get PDT history for reporting
   */
  async getPDTHistory(strategyId: string, days: number = 30): Promise<{
    dayTrades: DayTrade[];
    violations: any[];
    statusHistory: any[];
  }> {
    const dayTrades = await this.getDayTrades(strategyId, days);

    // Get PDT violations from audit log
    const cutoffDate = this.getBusinessDaysAgo(days);
    const violations = await db.query.auditLogs.findMany({
      where: and(
        eq(auditLogs.strategyId, strategyId),
        eq(auditLogs.eventType, 'pdt_violation'),
        gte(auditLogs.createdAt, cutoffDate)
      ),
    });

    return {
      dayTrades,
      violations,
      statusHistory: [], // Could implement daily status tracking
    };
  }
}

// Export singleton instance
export const pdtTracker = new PatternDayTraderService();
