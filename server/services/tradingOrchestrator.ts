import { randomUUID } from "crypto";
import { Strategy } from "../../drizzle/schema";
import {
  createAgentDecision,
  createAuditLog,
  getStrategy,
  getOpenPositions,
  createRiskAlert,
  createPerformanceMetric,
} from "../db";
import { AgentOrchestrator, TradeSignal } from "./agents";
import {
  calculateTechnicalIndicators,
  getCurrentPrice,
  updateMarketData,
  initializeMarketDataStream,
} from "./marketData";
import {
  validatePreTradeRisks,
  calculatePositionSize,
  checkDailyLossLimit,
  calculateTrailingStop,
  calculateSharpeRatio,
  calculateMaxDrawdown,
} from "./riskManagement";
import { executeBuyOrder, executeSellOrder, monitorPositions, getPortfolioSummary, updatePositionStopLoss } from "./tradingExecution";

/**
 * Trading Orchestrator
 * Coordinates the entire trading pipeline: data → agents → risk → execution
 */

export class TradingOrchestrator {
  private agentOrchestrator: AgentOrchestrator;
  private activeStrategies: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.agentOrchestrator = new AgentOrchestrator();
  }

  /**
   * Initialize a trading strategy
   */
  async initializeStrategy(strategyId: string, symbol: string): Promise<void> {
    const strategy = await getStrategy(strategyId);
    if (!strategy) {
      throw new Error("Strategy not found");
    }

    // Initialize market data stream for the symbol
    await initializeMarketDataStream(symbol, 10000);

    console.log(`[Orchestrator] Strategy ${strategyId} initialized for ${symbol}`);
  }

  /**
   * Start automated trading for a strategy
   */
  async startStrategy(strategyId: string, symbol: string, accountValue: number): Promise<void> {
    const strategy = await getStrategy(strategyId);
    if (!strategy) {
      throw new Error("Strategy not found");
    }

    if (!strategy.isActive) {
      throw new Error("Strategy is not active");
    }

    // Stop if already running
    this.stopStrategy(strategyId);

    console.log(`[Orchestrator] Starting strategy ${strategyId} for ${symbol}`);

    // Initialize if needed
    try {
      await this.initializeStrategy(strategyId, symbol);
    } catch (error) {
      console.log(`[Orchestrator] Market data already initialized for ${symbol}`);
    }

    // Run trading loop every 60 seconds
    const interval = setInterval(async () => {
      try {
        await this.runTradingCycle(strategyId, symbol, accountValue, strategy);
      } catch (error) {
        console.error(`[Orchestrator] Trading cycle error:`, error);
      }
    }, 60000); // 1 minute

    this.activeStrategies.set(strategyId, interval);

    // Run immediately
    await this.runTradingCycle(strategyId, symbol, accountValue, strategy);
  }

  /**
   * Stop automated trading for a strategy
   */
  stopStrategy(strategyId: string): void {
    const interval = this.activeStrategies.get(strategyId);
    if (interval) {
      clearInterval(interval);
      this.activeStrategies.delete(strategyId);
      console.log(`[Orchestrator] Strategy ${strategyId} stopped`);
    }
  }

  /**
   * Run a complete trading cycle
   */
  private async runTradingCycle(
    strategyId: string,
    symbol: string,
    accountValue: number,
    strategy: Strategy
  ): Promise<void> {
    console.log(`[Orchestrator] Running trading cycle for ${strategyId}`);

    // 1. Update market data
    const marketData = await updateMarketData(symbol);
    const currentPrice = marketData.close;

    // 2. Monitor existing positions (stop loss / take profit)
    const priceMap = new Map([[symbol, currentPrice]]);
    await monitorPositions(strategyId, priceMap);

    // 3. Calculate technical indicators
    const indicators = await calculateTechnicalIndicators(symbol);

    // 4. Run agent analysis
    const context = {
      symbol,
      currentPrice,
      indicators,
    };

    const { reports, signal } = await this.agentOrchestrator.generateTradeSignal(context);

    // 5. Store agent decisions
    for (const report of reports) {
      await createAgentDecision({
        id: randomUUID(),
        strategyId,
        symbol,
        agentType: report.agentType,
        recommendation: report.recommendation,
        confidence: report.confidence,
        reasoning: report.reasoning,
        metrics: JSON.stringify(report.metrics),
      });
    }

    // 6. Check if we should trade
    if (signal.action === "hold") {
      console.log(`[Orchestrator] Signal: HOLD - No action taken`);
      return;
    }

    // 7. Calculate position size
    const positionSize = calculatePositionSize(signal, currentPrice, accountValue, strategy.maxPositionSize, indicators.atr);

    // 8. Pre-trade risk checks
    const { checks, approved } = await validatePreTradeRisks(
      signal,
      strategyId,
      strategy.userId,
      strategy,
      accountValue,
      currentPrice
    );

    // Log risk checks
    await createAuditLog({
      id: randomUUID(),
      userId: strategy.userId,
      strategyId,
      eventType: "pre_trade_risk_check",
      eventData: JSON.stringify({ signal, positionSize, checks, approved }),
      riskChecks: JSON.stringify(checks),
    });

    if (!approved) {
      console.log(`[Orchestrator] Trade rejected by risk checks`);
      return;
    }

    // 9. Risk manager validation
    const openPositions = await getOpenPositions(strategyId);
    const riskValidation = await this.agentOrchestrator.validateTradeWithRisk(
      signal,
      openPositions,
      accountValue,
      strategy
    );

    await createAuditLog({
      id: randomUUID(),
      userId: strategy.userId,
      strategyId,
      eventType: "risk_manager_validation",
      eventData: JSON.stringify({ signal, riskValidation }),
    });

    if (!riskValidation.approved) {
      console.log(`[Orchestrator] Trade vetoed by risk manager: ${riskValidation.reasoning}`);
      return;
    }

    // 10. Execute trade
    if (signal.action === "buy") {
      const result = await executeBuyOrder(signal, strategyId, strategy.userId, currentPrice, positionSize);

      await createAuditLog({
        id: randomUUID(),
        userId: strategy.userId,
        strategyId,
        eventType: "trade_executed",
        eventData: JSON.stringify({ signal, result, positionSize }),
      });

      console.log(`[Orchestrator] ${result.message}`);
    } else if (signal.action === "sell") {
      // Close existing positions
      const positions = await getOpenPositions(strategyId);
      for (const position of positions) {
        if (position.symbol === symbol) {
          const result = await executeSellOrder(position, currentPrice, "Agent signal: sell");

          await createAuditLog({
            id: randomUUID(),
            userId: strategy.userId,
            strategyId,
            eventType: "trade_executed",
            eventData: JSON.stringify({ signal, result }),
          });

          console.log(`[Orchestrator] ${result.message}`);
        }
      }
    }

    // 11. Update trailing stops for open positions
    await this.updateTrailingStops(strategyId, symbol, currentPrice, indicators.atr);
  }

  /**
   * Update trailing stops for open positions
   */
  private async updateTrailingStops(strategyId: string, symbol: string, currentPrice: number, atr: number): Promise<void> {
    const openPositions = await getOpenPositions(strategyId);

    for (const position of openPositions) {
      if (position.symbol === symbol) {
        const newStopLoss = calculateTrailingStop(position, currentPrice, atr);

        // Only update if stop loss has moved favorably
        const currentStopLoss = position.stopLoss || 0;
        if (
          (position.side === "long" && newStopLoss > currentStopLoss) ||
          (position.side === "short" && newStopLoss < currentStopLoss)
        ) {
          await updatePositionStopLoss(position.id, newStopLoss / 100);
          console.log(
            `[Orchestrator] Updated trailing stop for ${position.symbol}: $${(newStopLoss / 100).toFixed(2)}`
          );
        }
      }
    }
  }

  /**
   * Calculate and store performance metrics
   */
  async calculatePerformanceMetrics(strategyId: string, accountValue: number): Promise<void> {
    const strategy = await getStrategy(strategyId);
    if (!strategy) return;

    const summary = await getPortfolioSummary(strategyId, accountValue);

    // For demo purposes, calculate simple metrics
    // In production, this would analyze historical trades and returns
    const dailyReturn = (summary.totalUnrealizedPnL / accountValue) * 10000; // in basis points

    await createPerformanceMetric({
      id: randomUUID(),
      strategyId,
      date: new Date(),
      totalValue: Math.round(accountValue * 100),
      dailyReturn: Math.round(dailyReturn),
      sharpeRatio: 0, // Would calculate from historical returns
      maxDrawdown: 0, // Would calculate from equity curve
      winRate: 0, // Would calculate from closed trades
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
    });
  }

  /**
   * Get current portfolio summary
   */
  async getPortfolioSummary(strategyId: string, accountValue: number) {
    return getPortfolioSummary(strategyId, accountValue);
  }

  /**
   * Manual trade execution (user-initiated)
   */
  async executeManualTrade(
    strategyId: string,
    symbol: string,
    action: "buy" | "sell",
    accountValue: number
  ): Promise<{ success: boolean; message: string }> {
    const strategy = await getStrategy(strategyId);
    if (!strategy) {
      return { success: false, message: "Strategy not found" };
    }

    const currentPrice = await getCurrentPrice(symbol);
    const indicators = await calculateTechnicalIndicators(symbol);

    if (action === "buy") {
      // Create manual buy signal
      const signal: TradeSignal = {
        action: "buy",
        symbol,
        confidence: 100, // Manual trades bypass confidence checks
        reasoning: "Manual trade initiated by user",
      };

      const positionSize = calculatePositionSize(signal, currentPrice, accountValue, strategy.maxPositionSize, indicators.atr);

      const { approved } = await validatePreTradeRisks(
        signal,
        strategyId,
        strategy.userId,
        strategy,
        accountValue,
        currentPrice
      );

      if (!approved) {
        return { success: false, message: "Trade rejected by risk checks" };
      }

      const result = await executeBuyOrder(signal, strategyId, strategy.userId, currentPrice, positionSize);

      await createAuditLog({
        id: randomUUID(),
        userId: strategy.userId,
        strategyId,
        eventType: "manual_trade",
        eventData: JSON.stringify({ action, result }),
      });

      return { success: result.status === "filled", message: result.message };
    } else {
      // Sell - close all positions for this symbol
      const positions = await getOpenPositions(strategyId);
      const symbolPositions = positions.filter((p) => p.symbol === symbol);

      if (symbolPositions.length === 0) {
        return { success: false, message: "No open positions to close" };
      }

      for (const position of symbolPositions) {
        const result = await executeSellOrder(position, currentPrice, "Manual close by user");

        await createAuditLog({
          id: randomUUID(),
          userId: strategy.userId,
          strategyId,
          eventType: "manual_trade",
          eventData: JSON.stringify({ action, result }),
        });
      }

      return { success: true, message: `Closed ${symbolPositions.length} position(s)` };
    }
  }
}

// Singleton instance
export const tradingOrchestrator = new TradingOrchestrator();

