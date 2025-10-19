import { randomUUID } from "crypto";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import {
  createStrategy,
  getUserStrategies,
  getStrategy,
  updateStrategy,
  deleteStrategy,
  getUserPositions,
  getOpenPositions,
  getStrategyOrders,
  getStrategyDecisions,
  getUserAuditLogs,
  getStrategyAuditLogs,
  getUnacknowledgedAlerts,
  acknowledgeAlert,
  getStrategyAlerts,
  getStrategyPerformance,
} from "./db";
import { tradingOrchestrator } from "./services/tradingOrchestrator";
import { MarketDataService } from "./services/marketData";
import { generateComplianceReport, checkRegulatoryCompliance, exportAuditTrail } from "./services/compliance";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Strategy Management
  strategies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserStrategies(ctx.user.id);
    }),

    get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
      return getStrategy(input.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          riskLevel: z.enum(["low", "medium", "high"]),
          maxPositionSize: z.number().min(1).max(10),
          dailyLossLimit: z.number().min(5).max(50),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const strategy = await createStrategy({
          id: randomUUID(),
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          isActive: false,
          riskLevel: input.riskLevel,
          maxPositionSize: input.maxPositionSize,
          dailyLossLimit: input.dailyLossLimit,
        });

        return strategy;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          description: z.string().optional(),
          isActive: z.boolean().optional(),
          riskLevel: z.enum(["low", "medium", "high"]).optional(),
          maxPositionSize: z.number().min(1).max(10).optional(),
          dailyLossLimit: z.number().min(5).max(50).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateStrategy(id, updates);
        return { success: true };
      }),

    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      await deleteStrategy(input.id);
      return { success: true };
    }),

    start: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          symbol: z.string(),
          accountValue: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await updateStrategy(input.id, { isActive: true });
        await tradingOrchestrator.startStrategy(input.id, input.symbol, input.accountValue);
        return { success: true, message: "Strategy started" };
      }),

    stop: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      await updateStrategy(input.id, { isActive: false });
      tradingOrchestrator.stopStrategy(input.id);
      return { success: true, message: "Strategy stopped" };
    }),
  }),

  // Trading Operations
  trading: router({
    positions: protectedProcedure.query(async ({ ctx }) => {
      const positions = await getUserPositions(ctx.user.id);
      return positions.map((pos) => ({
        id: pos.id,
        strategyId: pos.strategyId,
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice / 100,
        currentPrice: pos.currentPrice / 100,
        unrealizedPnL: pos.unrealizedPnL / 100,
        unrealizedPnLPercent: ((pos.unrealizedPnL / 100) / (pos.quantity * (pos.entryPrice / 100))) * 100,
        stopLoss: pos.stopLoss ? pos.stopLoss / 100 : null,
        takeProfit: pos.takeProfit ? pos.takeProfit / 100 : null,
        status: pos.status,
        openedAt: pos.openedAt,
        closedAt: pos.closedAt,
      }));
    }),

    strategyPositions: protectedProcedure.input(z.object({ strategyId: z.string() })).query(async ({ input }) => {
      const positions = await getOpenPositions(input.strategyId);
      return positions.map((pos) => ({
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
      }));
    }),

    orders: protectedProcedure.input(z.object({ strategyId: z.string() })).query(async ({ input }) => {
      const orders = await getStrategyOrders(input.strategyId);
      return orders.map((order) => ({
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price ? order.price / 100 : null,
        filledQuantity: order.filledQuantity,
        filledPrice: order.filledPrice ? order.filledPrice / 100 : null,
        status: order.status,
        createdAt: order.createdAt,
        filledAt: order.filledAt,
      }));
    }),

    manualTrade: protectedProcedure
      .input(
        z.object({
          strategyId: z.string(),
          symbol: z.string(),
          action: z.enum(["buy", "sell"]),
          accountValue: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        return tradingOrchestrator.executeManualTrade(
          input.strategyId,
          input.symbol,
          input.action,
          input.accountValue
        );
      }),

    portfolioSummary: protectedProcedure
      .input(
        z.object({
          strategyId: z.string(),
          accountValue: z.number(),
        })
      )
      .query(async ({ input }) => {
        return tradingOrchestrator.getPortfolioSummary(input.strategyId, input.accountValue);
      }),
  }),

  // Market Data
  market: router({
    currentPrice: protectedProcedure.input(z.object({ symbol: z.string() })).query(async ({ input }) => {
      return MarketDataService.getCurrentPrice(input.symbol);
    }),

    indicators: protectedProcedure.input(z.object({ symbol: z.string() })).query(async ({ input }) => {
      const { indicators } = await MarketDataService.getDataWithIndicators(input.symbol, '1mo', '1d');
      return indicators;
    }),
  }),

  // Agent Decisions
  agents: router({
    decisions: protectedProcedure
      .input(
        z.object({
          strategyId: z.string(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const decisions = await getStrategyDecisions(input.strategyId, input.limit);
        return decisions.map((d) => ({
          id: d.id,
          symbol: d.symbol,
          agentType: d.agentType,
          recommendation: d.recommendation,
          confidence: d.confidence,
          reasoning: d.reasoning,
          metrics: d.metrics ? JSON.parse(d.metrics) : {},
          createdAt: d.createdAt,
        }));
      }),
  }),

  // Risk & Compliance
  risk: router({
    alerts: protectedProcedure.query(async ({ ctx }) => {
      const alerts = await getUnacknowledgedAlerts(ctx.user.id);
      return alerts.map((alert) => ({
        id: alert.id,
        strategyId: alert.strategyId,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata ? JSON.parse(alert.metadata) : {},
        acknowledged: alert.acknowledged,
        createdAt: alert.createdAt,
      }));
    }),

    strategyAlerts: protectedProcedure.input(z.object({ strategyId: z.string() })).query(async ({ input }) => {
      const alerts = await getStrategyAlerts(input.strategyId);
      return alerts.map((alert) => ({
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata ? JSON.parse(alert.metadata) : {},
        acknowledged: alert.acknowledged,
        createdAt: alert.createdAt,
        acknowledgedAt: alert.acknowledgedAt,
      }));
    }),

    acknowledgeAlert: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      await acknowledgeAlert(input.id);
      return { success: true };
    }),
  }),

  // Audit & Compliance
  audit: router({
    logs: protectedProcedure
      .input(
        z.object({
          strategyId: z.string().optional(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const logs = input.strategyId
          ? await getStrategyAuditLogs(input.strategyId, input.limit)
          : await getUserAuditLogs(ctx.user.id, input.limit);

        return logs.map((log) => ({
          id: log.id,
          strategyId: log.strategyId,
          eventType: log.eventType,
          eventData: log.eventData ? JSON.parse(log.eventData) : {},
          riskChecks: log.riskChecks ? JSON.parse(log.riskChecks) : null,
          createdAt: log.createdAt,
        }));
      }),
  }),

  // Compliance & Reporting
  compliance: router({
    report: protectedProcedure
      .input(
        z.object({
          strategyId: z.string(),
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        const report = await generateComplianceReport(
          input.strategyId,
          new Date(input.startDate),
          new Date(input.endDate)
        );
        return report;
      }),

    checkCompliance: protectedProcedure
      .input(z.object({ strategyId: z.string() }))
      .query(async ({ input }) => {
        return checkRegulatoryCompliance(input.strategyId);
      }),

    exportAudit: protectedProcedure
      .input(
        z.object({
          strategyId: z.string(),
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        return exportAuditTrail(input.strategyId, new Date(input.startDate), new Date(input.endDate));
      }),
  }),

  // Performance Analytics
  performance: router({
    metrics: protectedProcedure
      .input(
        z.object({
          strategyId: z.string(),
          days: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const metrics = await getStrategyPerformance(input.strategyId, input.days);
        return metrics.map((m) => ({
          id: m.id,
          date: m.date,
          totalValue: m.totalValue / 100,
          dailyReturn: m.dailyReturn / 100,
          sharpeRatio: m.sharpeRatio ? m.sharpeRatio / 100 : null,
          maxDrawdown: m.maxDrawdown ? m.maxDrawdown / 100 : null,
          winRate: m.winRate,
          totalTrades: m.totalTrades,
          winningTrades: m.winningTrades,
          losingTrades: m.losingTrades,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;

