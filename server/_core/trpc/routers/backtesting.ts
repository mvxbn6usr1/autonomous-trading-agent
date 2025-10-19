// tRPC router for backtesting endpoints

import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { BacktestEngine } from "../../../services/backtesting/backtestEngine";
import { BacktestConfig } from "../../../services/backtesting/types";
import { backtests, backtestTrades, backtestEquityCurve, InsertBacktest, InsertBacktestTrade, InsertBacktestEquityCurve } from "../../../../drizzle/schema";
import { getDb } from "../../../db";

const db = getDb();
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export const backtestingRouter = router({
  // Run a new backtest
  runBacktest: publicProcedure
    .input(z.object({
      strategyId: z.string(),
      name: z.string(),
      symbols: z.array(z.string()),
      startDate: z.string(), // ISO date string
      endDate: z.string(),
      initialCapital: z.number(),
      commission: z.number().default(1.0),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id || 'anonymous';
      const backtestId = nanoid();

      // Create backtest record
      const backtestRecord: InsertBacktest = {
        id: backtestId,
        userId,
        strategyId: input.strategyId,
        name: input.name,
        symbols: JSON.stringify(input.symbols),
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        initialCapital: input.initialCapital.toString(),
        status: 'running',
      };

      await db.insert(backtests).values(backtestRecord);

      try {
        // Configure backtest
        const config: BacktestConfig = {
          strategyId: input.strategyId,
          symbols: input.symbols,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          initialCapital: input.initialCapital,
          commission: input.commission,
        };

        // Run backtest
        const engine = new BacktestEngine(config);
        const result = await engine.runBacktest();

        // Save results
        await db.update(backtests)
          .set({
            finalEquity: result.equityCurve[result.equityCurve.length - 1]?.value.toString(),
            totalReturn: result.totalReturn.toString(),
            sharpeRatio: result.sharpeRatio.toString(),
            maxDrawdown: result.maxDrawdown.toString(),
            winRate: result.winRate.toString(),
            totalTrades: result.totalTrades,
            profitFactor: result.profitFactor.toString(),
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(backtests.id, backtestId));

        // Save trades
        const tradeRecords: InsertBacktestTrade[] = result.trades.map(trade => ({
          id: nanoid(),
          backtestId,
          date: trade.date,
          symbol: trade.symbol,
          action: trade.action,
          quantity: trade.quantity,
          price: trade.price.toString(),
          commission: trade.commission.toString(),
          pnl: trade.pnl.toString(),
          entryPrice: trade.entryPrice?.toString(),
          exitPrice: trade.exitPrice?.toString(),
        }));

        if (tradeRecords.length > 0) {
          await db.insert(backtestTrades).values(tradeRecords);
        }

        // Save equity curve
        const equityRecords: InsertBacktestEquityCurve[] = result.equityCurve.map(point => ({
          id: nanoid(),
          backtestId,
          date: point.date,
          value: point.value.toString(),
        }));

        if (equityRecords.length > 0) {
          await db.insert(backtestEquityCurve).values(equityRecords);
        }

        return {
          backtestId,
          result,
        };

      } catch (error) {
        // Update backtest as failed
        await db.update(backtests)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          })
          .where(eq(backtests.id, backtestId));

        throw error;
      }
    }),

  // Get backtest results
  getBacktest: publicProcedure
    .input(z.object({
      backtestId: z.string(),
    }))
    .query(async ({ input }) => {
      const backtest = await db.query.backtests.findFirst({
        where: eq(backtests.id, input.backtestId),
      });

      if (!backtest) {
        throw new Error('Backtest not found');
      }

      const trades = await db.query.backtestTrades.findMany({
        where: eq(backtestTrades.backtestId, input.backtestId),
      });

      const equityCurve = await db.query.backtestEquityCurve.findMany({
        where: eq(backtestEquityCurve.backtestId, input.backtestId),
      });

      return {
        backtest,
        trades,
        equityCurve,
      };
    }),

  // List backtests for a strategy
  listBacktests: publicProcedure
    .input(z.object({
      strategyId: z.string(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      const results = await db.query.backtests.findMany({
        where: eq(backtests.strategyId, input.strategyId),
        orderBy: [desc(backtests.createdAt)],
        limit: input.limit,
      });

      return results;
    }),

  // Get backtest summary statistics
  getBacktestSummary: publicProcedure
    .input(z.object({
      backtestId: z.string(),
    }))
    .query(async ({ input }) => {
      const backtest = await db.query.backtests.findFirst({
        where: eq(backtests.id, input.backtestId),
      });

      if (!backtest) {
        throw new Error('Backtest not found');
      }

      const trades = await db.query.backtestTrades.findMany({
        where: eq(backtestTrades.backtestId, input.backtestId),
      });

      // Calculate additional statistics
      const winningTrades = trades.filter(t => parseFloat(t.pnl) > 0);
      const losingTrades = trades.filter(t => parseFloat(t.pnl) < 0);

      return {
        ...backtest,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        avgWin: winningTrades.length > 0 
          ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0) / winningTrades.length 
          : 0,
        avgLoss: losingTrades.length > 0 
          ? losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl), 0) / losingTrades.length 
          : 0,
        totalPnL: trades.reduce((sum, t) => sum + parseFloat(t.pnl), 0),
      };
    }),
});
