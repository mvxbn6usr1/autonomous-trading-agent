/**
 * Trading Loop Manager
 * Manages continuous autonomous trading for active strategies
 */

import { getActiveStrategies, updateStrategy } from '../db';
import { tradingOrchestrator } from './tradingOrchestrator';

interface ActiveLoop {
  strategyId: string;
  intervalId: NodeJS.Timeout;
  isRunning: boolean;
  lastRun: Date;
  nextRun: Date;
}

class TradingLoopManager {
  private activeLoops: Map<string, ActiveLoop> = new Map();
  private defaultIntervalMs = 5 * 60 * 1000; // 5 minutes default

  /**
   * Start trading loop for a specific strategy
   */
  async startLoop(strategyId: string, intervalMs: number = this.defaultIntervalMs): Promise<void> {
    // Check if already running
    if (this.activeLoops.has(strategyId)) {
      console.log(`[TradingLoop] Strategy ${strategyId} already has an active loop`);
      return;
    }

    console.log(`[TradingLoop] Starting loop for strategy ${strategyId} (interval: ${intervalMs}ms)`);

    // Run immediately on start
    await this.runTradingCycle(strategyId);

    // Set up interval
    const intervalId = setInterval(async () => {
      await this.runTradingCycle(strategyId);
    }, intervalMs);

    // Store loop info
    const now = new Date();
    this.activeLoops.set(strategyId, {
      strategyId,
      intervalId,
      isRunning: true,
      lastRun: now,
      nextRun: new Date(now.getTime() + intervalMs),
    });
  }

  /**
   * Stop trading loop for a specific strategy
   */
  stopLoop(strategyId: string): void {
    const loop = this.activeLoops.get(strategyId);
    if (!loop) {
      console.log(`[TradingLoop] No active loop found for strategy ${strategyId}`);
      return;
    }

    console.log(`[TradingLoop] Stopping loop for strategy ${strategyId}`);
    clearInterval(loop.intervalId);
    this.activeLoops.delete(strategyId);
  }

  /**
   * Run a single trading cycle for a strategy
   */
  async runTradingCycle(strategyId: string): Promise<void> {
    const loop = this.activeLoops.get(strategyId);
    if (!loop) return;

    try {
      console.log(`[TradingLoop] Running cycle for strategy ${strategyId}`);
      
      // Update last run time
      loop.lastRun = new Date();
      loop.nextRun = new Date(loop.lastRun.getTime() + this.defaultIntervalMs);

      // Fetch strategy data
      const { getStrategy } = await import('../db');
      const strategy = await getStrategy(strategyId);
      if (!strategy) {
        console.error(`[TradingLoop] Strategy ${strategyId} not found`);
        return;
      }

      // For now, use strategy symbols (would need to be added to schema)
      // Using a default symbol for testing
      const symbol = 'AAPL'; // TODO: Get from strategy.symbols
      const accountValue = 100000; // TODO: Get from portfolio

      // Execute trading cycle through orchestrator
      await tradingOrchestrator.startStrategy(strategyId, symbol, accountValue);

      console.log(`[TradingLoop] Cycle completed for strategy ${strategyId}`);
    } catch (error: any) {
      console.error(`[TradingLoop] Error in cycle for strategy ${strategyId}:`, error.message);
      // Don't stop the loop on error, just log it
    }
  }

  /**
   * Start all active strategies
   */
  async startAllActiveStrategies(): Promise<void> {
    console.log('[TradingLoop] Starting all active strategies...');
    
    try {
      const strategies = await getActiveStrategies();
      console.log(`[TradingLoop] Found ${strategies.length} active strategies`);

      for (const strategy of strategies) {
        await this.startLoop(strategy.id);
      }
    } catch (error: any) {
      console.error('[TradingLoop] Error starting active strategies:', error.message);
    }
  }

  /**
   * Stop all trading loops
   */
  stopAllLoops(): void {
    console.log('[TradingLoop] Stopping all trading loops...');
    
    for (const [strategyId] of this.activeLoops) {
      this.stopLoop(strategyId);
    }
  }

  /**
   * Get status of all active loops
   */
  getLoopStatus(): Array<{
    strategyId: string;
    isRunning: boolean;
    lastRun: Date;
    nextRun: Date;
  }> {
    return Array.from(this.activeLoops.values()).map(loop => ({
      strategyId: loop.strategyId,
      isRunning: loop.isRunning,
      lastRun: loop.lastRun,
      nextRun: loop.nextRun,
    }));
  }

  /**
   * Get status for a specific strategy
   */
  getStrategyStatus(strategyId: string): {
    isRunning: boolean;
    lastRun?: Date;
    nextRun?: Date;
  } | null {
    const loop = this.activeLoops.get(strategyId);
    if (!loop) {
      return { isRunning: false };
    }

    return {
      isRunning: loop.isRunning,
      lastRun: loop.lastRun,
      nextRun: loop.nextRun,
    };
  }

  /**
   * Restart a specific strategy loop
   */
  async restartLoop(strategyId: string, intervalMs?: number): Promise<void> {
    this.stopLoop(strategyId);
    await this.startLoop(strategyId, intervalMs);
  }
}

// Export singleton instance
export const tradingLoopManager = new TradingLoopManager();

// Start all active strategies on server startup
// This will be called from the main server file
export async function initializeTradingLoops(): Promise<void> {
  console.log('[TradingLoop] Initializing trading loops...');
  await tradingLoopManager.startAllActiveStrategies();
}

// Cleanup on server shutdown
export function shutdownTradingLoops(): void {
  console.log('[TradingLoop] Shutting down trading loops...');
  tradingLoopManager.stopAllLoops();
}

