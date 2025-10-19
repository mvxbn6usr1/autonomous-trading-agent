/**
 * Portfolio Manager Agent
 * Analyzes overall portfolio health, suggests rebalancing, and manages allocation
 */

import { callLLM } from '../llm/openrouter';
import type { Position } from '../../../drizzle/schema';
import type { ComprehensiveStockData } from '../marketData/enhancedDataProvider';

export interface PortfolioAnalysis {
  recommendation: 'hold' | 'rebalance' | 'reduce_risk' | 'increase_exposure';
  confidence: number;
  currentAllocation: Record<string, number>; // symbol -> percentage
  targetAllocation: Record<string, number>; // symbol -> percentage
  rebalancingActions: Array<{
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    targetShares: number;
    reason: string;
  }>;
  portfolioMetrics: {
    totalValue: number;
    diversificationScore: number; // 0-100
    riskScore: number; // 0-100
    concentrationRisk: number; // 0-100
    sectorExposure: Record<string, number>;
  };
  reasoning: string;
  keyPoints: string[];
}

export class PortfolioManagerAgent {
  private model = 'deepseek/deepseek-chat-v3';

  async analyze(
    positions: Position[],
    marketData: Map<string, ComprehensiveStockData>,
    cashBalance: number,
    portfolioValue: number,
    targetAllocation?: Record<string, number>
  ): Promise<PortfolioAnalysis> {
    console.log('[PortfolioManager] Analyzing portfolio with', positions.length, 'positions');

    // Calculate current allocation
    const currentAllocation: Record<string, number> = {};
    const cashPercent = (cashBalance / portfolioValue) * 100;
    currentAllocation['CASH'] = cashPercent;

    for (const pos of positions) {
      const currentValue = pos.quantity * pos.currentPrice;
      const allocation = (currentValue / portfolioValue) * 100;
      currentAllocation[pos.symbol] = allocation;
    }

    // Build portfolio summary
    const portfolioSummary = positions.map(pos => {
      const data = marketData.get(pos.symbol);
      const currentValue = pos.quantity * pos.currentPrice;
      const costBasis = pos.quantity * pos.entryPrice;
      const unrealizedPnLPercent = ((currentValue - costBasis) / costBasis) * 100;
      
      return {
        symbol: pos.symbol,
        shares: pos.quantity,
        entryPrice: pos.entryPrice / 100,
        currentPrice: pos.currentPrice / 100,
        value: currentValue / 100,
        allocation: currentAllocation[pos.symbol].toFixed(2) + '%',
        unrealizedPnL: pos.unrealizedPnL / 100,
        unrealizedPnLPercent: unrealizedPnLPercent.toFixed(2),
        companyName: data?.meta.companyName || pos.symbol,
        fiftyTwoWeekRange: data ? `$${data.meta.fiftyTwoWeekLow.toFixed(2)} - $${data.meta.fiftyTwoWeekHigh.toFixed(2)}` : 'N/A'
      };
    });

    const prompt = `You are a Portfolio Manager Agent responsible for managing a multi-stock portfolio.

**Current Portfolio:**
- Total Value: $${(portfolioValue / 100).toFixed(2)}
- Cash: $${(cashBalance / 100).toFixed(2)} (${cashPercent.toFixed(2)}%)
- Number of Positions: ${positions.length}

**Holdings:**
${JSON.stringify(portfolioSummary, null, 2)}

**Current Allocation:**
${JSON.stringify(currentAllocation, null, 2)}

${targetAllocation ? `**Target Allocation:**\n${JSON.stringify(targetAllocation, null, 2)}\n` : ''}

**Your Task:**
1. Analyze the overall portfolio health and diversification
2. Assess concentration risk (over-exposure to any single stock)
3. Evaluate sector exposure and correlation risks
4. Compare current allocation to target allocation (if provided)
5. Identify rebalancing opportunities
6. Recommend specific actions (buy/sell/hold) for each position
7. Calculate portfolio risk metrics

**Portfolio Management Principles:**
- Maintain diversification (no single stock should exceed 20% unless intentional)
- Keep 5-15% cash for opportunities
- Rebalance when allocation drifts >5% from target
- Consider tax implications of selling winners
- Trim losers that no longer fit the strategy
- Let winners run unless they become overweight

Respond in JSON format:
{
  "recommendation": "hold|rebalance|reduce_risk|increase_exposure",
  "confidence": 0.0-1.0,
  "currentAllocation": { "SYMBOL": percentage },
  "targetAllocation": { "SYMBOL": percentage },
  "rebalancingActions": [
    {
      "symbol": "SYMBOL",
      "action": "buy|sell|hold",
      "targetShares": number,
      "reason": "explanation"
    }
  ],
  "portfolioMetrics": {
    "totalValue": number,
    "diversificationScore": 0-100,
    "riskScore": 0-100,
    "concentrationRisk": 0-100,
    "sectorExposure": { "Technology": 60, "Healthcare": 20, ... }
  },
  "reasoning": "detailed explanation",
  "keyPoints": ["point1", "point2", ...]
}`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      this.model,
      0.3
    );
    
    try {
      const analysis = JSON.parse(response.content) as PortfolioAnalysis;
      console.log('[PortfolioManager] Analysis complete:', analysis.recommendation);
      return analysis;
    } catch (error) {
      console.error('[PortfolioManager] Failed to parse LLM response:', error);
      throw new Error('Failed to parse portfolio analysis');
    }
  }

  /**
   * Quick portfolio health check
   */
  async quickHealthCheck(
    positions: Position[],
    portfolioValue: number
  ): Promise<{
    health: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check concentration
    for (const pos of positions) {
      const currentValue = pos.quantity * pos.currentPrice;
      const allocation = (currentValue / portfolioValue) * 100;
      if (allocation > 25) {
        issues.push(`${pos.symbol} is ${allocation.toFixed(1)}% of portfolio (high concentration)`);
        suggestions.push(`Consider trimming ${pos.symbol} to reduce concentration risk`);
      }
    }

    // Check number of positions
    if (positions.length < 3) {
      issues.push('Portfolio has fewer than 3 positions (low diversification)');
      suggestions.push('Consider adding more positions to improve diversification');
    } else if (positions.length > 20) {
      issues.push('Portfolio has more than 20 positions (over-diversification)');
      suggestions.push('Consider consolidating positions into best ideas');
    }

    // Check for big losers
    for (const pos of positions) {
      const currentValue = pos.quantity * pos.currentPrice;
      const costBasis = pos.quantity * pos.entryPrice;
      const unrealizedPnLPercent = ((currentValue - costBasis) / costBasis) * 100;
      
      if (unrealizedPnLPercent < -20) {
        issues.push(`${pos.symbol} is down ${Math.abs(unrealizedPnLPercent).toFixed(1)}%`);
        suggestions.push(`Review ${pos.symbol} thesis - consider cutting losses if fundamentals deteriorated`);
      }
    }

    // Determine health
    let health: 'excellent' | 'good' | 'fair' | 'poor';
    if (issues.length === 0) {
      health = 'excellent';
    } else if (issues.length <= 2) {
      health = 'good';
    } else if (issues.length <= 4) {
      health = 'fair';
    } else {
      health = 'poor';
    }

    return { health, issues, suggestions };
  }
}

export const portfolioManagerAgent = new PortfolioManagerAgent();

