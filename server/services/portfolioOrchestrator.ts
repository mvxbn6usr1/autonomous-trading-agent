/**
 * Portfolio Orchestrator
 * Coordinates all agents for comprehensive portfolio management
 */

import { randomUUID } from 'crypto';
import * as db from '../db';
import { portfolioManagerAgent } from './agents/portfolioManagerAgent';
import { marketScannerAgent } from './agents/marketScannerAgent';
import { AgentOrchestrator } from './agents';
import { enhancedDataProvider } from './marketData/enhancedDataProvider';
import { monitorPositions } from './tradingExecutionService';
import { getBroker } from './brokers';
import type { Strategy, Position } from '../../drizzle/schema';

const agentOrchestrator = new AgentOrchestrator();

export interface PortfolioDecision {
  action: 'rebalance' | 'add_position' | 'trim_position' | 'hold';
  symbol?: string;
  quantity?: number;
  reasoning: string;
  confidence: number;
  portfolioHealth: string;
  recommendations: string[];
}

export class PortfolioOrchestrator {
  /**
   * Run complete portfolio management cycle
   */
  async runPortfolioCycle(strategyId: string): Promise<PortfolioDecision> {
    console.log(`[PortfolioOrchestrator] Starting portfolio cycle for strategy ${strategyId}`);

    try {
      // 1. Get strategy and current state
      const strategy = await db.getStrategy(strategyId);
      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found`);
      }

      if (!strategy.isActive) {
        console.log(`[PortfolioOrchestrator] Strategy ${strategyId} is not active`);
        return {
          action: 'hold',
          reasoning: 'Strategy is not active',
          confidence: 1.0,
          portfolioHealth: 'inactive',
          recommendations: []
        };
      }

      // 2. Get current positions and portfolio state
      const positions = await db.getOpenPositions(strategyId);
      const broker = getBroker();
      const account = await broker.getAccount();
      
      const portfolioValue = account.portfolioValue;
      const cashBalance = account.cash;

      console.log(`[PortfolioOrchestrator] Portfolio: ${positions.length} positions, $${(portfolioValue / 100).toFixed(2)} total value`);

      // 3. Get or create portfolio
      let portfolio = await db.getPortfolioByStrategy(strategyId);
      if (!portfolio) {
        portfolio = await db.createPortfolio({
          id: randomUUID(),
          strategyId,
          name: `${strategy.name} Portfolio`,
          description: 'Auto-managed portfolio',
          maxStocks: 10,
          minCashPercent: 10,
          rebalanceFrequency: 'weekly'
        });
      }

      // 4. Fetch comprehensive market data for all positions
      const symbols = positions.map(p => p.symbol);
      const marketData = symbols.length > 0 
        ? await enhancedDataProvider.getBatchData(symbols, '3mo')
        : new Map();

      // 5. Run portfolio health check
      const healthCheck = await portfolioManagerAgent.quickHealthCheck(positions, portfolioValue);
      console.log(`[PortfolioOrchestrator] Portfolio health: ${healthCheck.health}`);

      // 6. If portfolio needs attention, run full analysis
      if (healthCheck.health === 'poor' || healthCheck.health === 'fair') {
        console.log(`[PortfolioOrchestrator] Running full portfolio analysis...`);
        
        const portfolioAnalysis = await portfolioManagerAgent.analyze(
          positions,
          marketData,
          cashBalance,
          portfolioValue,
          portfolio.targetAllocation ? JSON.parse(portfolio.targetAllocation) : undefined
        );

        // 7. Execute rebalancing actions if needed
        if (portfolioAnalysis.recommendation === 'rebalance') {
          const action = portfolioAnalysis.rebalancingActions[0]; // Start with first action
          
          if (action) {
            console.log(`[PortfolioOrchestrator] Rebalancing: ${action.action} ${action.symbol}`);
            
            // Save portfolio snapshot before rebalancing
            await this.savePortfolioSnapshot(portfolio.id, positions, cashBalance, portfolioValue);

            return {
              action: action.action === 'buy' ? 'add_position' : 'trim_position',
              symbol: action.symbol,
              quantity: action.targetShares,
              reasoning: action.reason,
              confidence: portfolioAnalysis.confidence,
              portfolioHealth: healthCheck.health,
              recommendations: portfolioAnalysis.keyPoints
            };
          }
        }
      }

      // 8. If portfolio is healthy, look for new opportunities
      if (positions.length < (portfolio.maxStocks || 10)) {
        console.log(`[PortfolioOrchestrator] Scanning for new opportunities...`);
        
        const watchlist = await db.getWatchlist(strategyId, 'watching');
        
        // If watchlist is empty, run a market scan
        if (watchlist.length === 0) {
          console.log(`[PortfolioOrchestrator] Watchlist empty, running market scan...`);
          
          const scanType = this.determineScanType(strategy.riskLevel);
          const scanResults = await marketScannerAgent.quickScan(scanType);
          
          // Add top picks to watchlist
          for (const symbol of scanResults.topPicks.slice(0, 5)) {
            const opportunity = scanResults.opportunities.find(o => o.symbol === symbol);
            if (opportunity) {
              await db.addToWatchlist({
                id: randomUUID(),
                strategyId,
                symbol,
                addedReason: opportunity.reasoning,
                targetEntryPrice: opportunity.targetEntry ? Math.round(opportunity.targetEntry * 100) : undefined,
                targetAllocation: opportunity.targetAllocation,
                priority: opportunity.score >= 80 ? 'high' : 'medium',
                status: 'watching'
              });
            }
          }
          
          console.log(`[PortfolioOrchestrator] Added ${scanResults.topPicks.length} stocks to watchlist`);
        }

        // Analyze watchlist stocks for entry
        const currentHoldings = positions.map(p => p.symbol);
        for (const item of watchlist.slice(0, 3)) { // Check top 3 watchlist items
          if (currentHoldings.includes(item.symbol)) continue;

          console.log(`[PortfolioOrchestrator] Analyzing watchlist stock: ${item.symbol}`);
          
          // Fetch market data for the watchlist stock
          const stockData = await enhancedDataProvider.getComprehensiveData(item.symbol, '3mo');
          
          // Build agent context
          const agentContext = {
            symbol: item.symbol,
            currentPrice: stockData.currentPrice,
            indicators: {} as any, // Would need to calculate indicators
            strategy: {
              riskLevel: strategy.riskLevel,
              maxPositionSize: strategy.maxPositionSize,
              stopLossPercent: 5
            },
            portfolio: {
              totalValue: portfolioValue,
              availableCash: cashBalance,
              currentPositions: positions.length
            }
          };
          
          // Run full agent analysis on watchlist stock
          const decision = await agentOrchestrator.analyzeAndDecide(agentContext);
          
          if (decision.action === 'buy') {
            console.log(`[PortfolioOrchestrator] Watchlist stock ${item.symbol} approved for entry`);
            
            // Update watchlist status
            await db.updateWatchlistItem(item.id, { status: 'triggered' });
            
            return {
              action: 'add_position',
              symbol: item.symbol,
              reasoning: `Watchlist opportunity: ${item.addedReason}. Agent consensus: BUY with ${(decision.confidence * 100).toFixed(0)}% confidence.`,
              confidence: decision.confidence,
              portfolioHealth: healthCheck.health,
              recommendations: [decision.reasoning]
            };
          }
        }
      }

      // 9. Monitor existing positions for exits
      // (monitorPositions is called separately in the trading loop)

      // 10. Save portfolio snapshot (daily)
      await this.savePortfolioSnapshot(portfolio.id, positions, cashBalance, portfolioValue);

      return {
        action: 'hold',
        reasoning: `Portfolio is ${healthCheck.health}. ${healthCheck.issues.length} issues identified. Continuing to monitor.`,
        confidence: 0.8,
        portfolioHealth: healthCheck.health,
        recommendations: healthCheck.suggestions
      };

    } catch (error: any) {
      console.error(`[PortfolioOrchestrator] Error in portfolio cycle:`, error);
      throw error;
    }
  }

  /**
   * Determine scan type based on risk level
   */
  private determineScanType(riskLevel: string): 'momentum' | 'value' | 'growth' | 'technical' | 'earnings' {
    switch (riskLevel) {
      case 'low':
        return 'value';
      case 'high':
        return 'momentum';
      default:
        return 'growth';
    }
  }

  /**
   * Save portfolio snapshot for performance tracking
   */
  private async savePortfolioSnapshot(
    portfolioId: string,
    positions: Position[],
    cashValue: number,
    totalValue: number
  ): Promise<void> {
    const positionsValue = positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);
    const unrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const realizedPnL = positions.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);

    const holdings = positions.map(pos => ({
      symbol: pos.symbol,
      quantity: pos.quantity,
      value: pos.quantity * pos.currentPrice,
      allocation: ((pos.quantity * pos.currentPrice) / totalValue) * 100
    }));

    await db.savePortfolioSnapshot({
      id: randomUUID(),
      portfolioId,
      totalValue,
      cashValue,
      positionsValue,
      unrealizedPnL,
      realizedPnL,
      holdings: JSON.stringify(holdings),
      snapshotAt: new Date()
    });
  }
}

export const portfolioOrchestrator = new PortfolioOrchestrator();

