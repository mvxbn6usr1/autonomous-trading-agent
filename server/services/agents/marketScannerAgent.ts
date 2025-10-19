/**
 * Market Scanner Agent
 * Scans the market for trading opportunities based on various criteria
 */

import { callLLM } from '../llm/openrouter';
import { enhancedDataProvider, type ComprehensiveStockData } from '../marketData/enhancedDataProvider';

export interface ScanResult {
  symbol: string;
  score: number; // 0-100
  signals: string[];
  metrics: {
    momentum?: number;
    value?: number;
    growth?: number;
    technical?: number;
  };
  recommendation: 'strong_buy' | 'buy' | 'watch' | 'avoid';
  reasoning: string;
  keyPoints: string[];
  targetEntry?: number;
  targetAllocation?: number;
}

export interface MarketScanSummary {
  scanType: 'momentum' | 'value' | 'growth' | 'technical' | 'earnings';
  totalScanned: number;
  opportunities: ScanResult[];
  topPicks: string[];
  summary: string;
}

export class MarketScannerAgent {
  private model = 'anthropic/claude-haiku-4.5'; // Fast for scanning

  /**
   * Scan a list of symbols for opportunities
   */
  async scanSymbols(
    symbols: string[],
    scanType: 'momentum' | 'value' | 'growth' | 'technical' | 'earnings',
    currentHoldings: string[] = []
  ): Promise<MarketScanSummary> {
    console.log(`[MarketScanner] Scanning ${symbols.length} symbols for ${scanType} opportunities`);

    // Fetch data for all symbols
    const marketData = await enhancedDataProvider.getBatchData(symbols, '3mo');

    // Analyze each symbol
    const results: ScanResult[] = [];
    
    for (const [symbol, data] of marketData.entries()) {
      try {
        const result = await this.analyzeSymbol(symbol, data, scanType, currentHoldings.includes(symbol));
        if (result.score >= 50) { // Only include decent opportunities
          results.push(result);
        }
      } catch (error: any) {
        console.error(`[MarketScanner] Failed to analyze ${symbol}:`, error.message);
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Get top picks
    const topPicks = results
      .filter(r => r.score >= 75)
      .slice(0, 10)
      .map(r => r.symbol);

    return {
      scanType,
      totalScanned: symbols.length,
      opportunities: results,
      topPicks,
      summary: this.generateSummary(results, scanType)
    };
  }

  /**
   * Analyze a single symbol
   */
  private async analyzeSymbol(
    symbol: string,
    data: ComprehensiveStockData,
    scanType: string,
    alreadyHeld: boolean
  ): Promise<ScanResult> {
    const priceHistory = data.priceHistory.slice(-30); // Last 30 days
    const currentPrice = data.currentPrice;
    const fiftyTwoWeekLow = data.meta.fiftyTwoWeekLow;
    const fiftyTwoWeekHigh = data.meta.fiftyTwoWeekHigh;

    // Calculate basic metrics
    const priceChange30d = ((currentPrice - priceHistory[0].close) / priceHistory[0].close) * 100;
    const distanceFromHigh = ((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100;
    const distanceFromLow = ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100;

    const prompt = `You are a Market Scanner Agent analyzing ${symbol} for ${scanType} opportunities.

**Stock Data:**
- Symbol: ${symbol}
- Company: ${data.meta.companyName}
- Current Price: $${currentPrice.toFixed(2)}
- 52-Week Range: $${fiftyTwoWeekLow.toFixed(2)} - $${fiftyTwoWeekHigh.toFixed(2)}
- Distance from 52W High: ${distanceFromHigh.toFixed(2)}%
- Distance from 52W Low: ${distanceFromLow.toFixed(2)}%
- 30-Day Price Change: ${priceChange30d.toFixed(2)}%
- Already Held: ${alreadyHeld}

**Price History (Last 10 Days):**
${priceHistory.slice(-10).map(p => `${p.date.toISOString().split('T')[0]}: $${p.close.toFixed(2)} (Vol: ${p.volume.toLocaleString()})`).join('\n')}

**Scan Type: ${scanType.toUpperCase()}**

${this.getScanCriteria(scanType)}

**Your Task:**
1. Analyze if this stock meets the ${scanType} criteria
2. Calculate a score (0-100) based on how well it fits the criteria
3. Identify specific signals (e.g., "Breaking out above resistance", "Oversold RSI")
4. Provide a recommendation: strong_buy, buy, watch, or avoid
5. Suggest target entry price and allocation (if applicable)

Respond in JSON format:
{
  "symbol": "${symbol}",
  "score": 0-100,
  "signals": ["signal1", "signal2", ...],
  "metrics": {
    "momentum": 0-100,
    "value": 0-100,
    "growth": 0-100,
    "technical": 0-100
  },
  "recommendation": "strong_buy|buy|watch|avoid",
  "reasoning": "detailed explanation",
  "keyPoints": ["point1", "point2", ...],
  "targetEntry": price (optional),
  "targetAllocation": percentage (optional)
}`;

    const response = await callLLM(
      [{ role: 'user', content: prompt }],
      this.model,
      0.5
    );

    try {
      const result = JSON.parse(response.content) as ScanResult;
      return result;
    } catch (error) {
      console.error(`[MarketScanner] Failed to parse response for ${symbol}:`, error);
      // Return a default low-score result
      return {
        symbol,
        score: 0,
        signals: [],
        metrics: {},
        recommendation: 'avoid',
        reasoning: 'Failed to analyze',
        keyPoints: []
      };
    }
  }

  /**
   * Get scan-specific criteria
   */
  private getScanCriteria(scanType: string): string {
    const criteria: Record<string, string> = {
      momentum: `
**Momentum Criteria:**
- Strong recent price action (>10% in last month)
- Increasing volume
- Breaking out of consolidation
- Relative strength vs market
- Positive price momentum
`,
      value: `
**Value Criteria:**
- Trading below intrinsic value
- Low P/E ratio relative to peers
- Strong fundamentals (revenue, earnings growth)
- Margin of safety
- Potential catalysts for re-rating
`,
      growth: `
**Growth Criteria:**
- High revenue growth rate (>20% YoY)
- Expanding margins
- Large addressable market
- Competitive advantages
- Strong management execution
`,
      technical: `
**Technical Criteria:**
- Chart patterns (breakouts, reversals)
- Support/resistance levels
- Volume analysis
- Trend strength
- Risk/reward setup
`,
      earnings: `
**Earnings Criteria:**
- Upcoming earnings catalyst
- History of beating estimates
- Positive guidance trends
- Earnings momentum
- Post-earnings price action potential
`
    };

    return criteria[scanType] || criteria.technical;
  }

  /**
   * Generate summary of scan results
   */
  private generateSummary(results: ScanResult[], scanType: string): string {
    const highScore = results.filter(r => r.score >= 75).length;
    const mediumScore = results.filter(r => r.score >= 60 && r.score < 75).length;
    const lowScore = results.filter(r => r.score < 60).length;

    return `Found ${highScore} strong opportunities, ${mediumScore} moderate opportunities, and ${lowScore} weak opportunities in ${scanType} scan.`;
  }

  /**
   * Quick scan of popular stocks
   */
  async quickScan(scanType: 'momentum' | 'value' | 'growth' | 'technical' | 'earnings'): Promise<MarketScanSummary> {
    // Popular stocks to scan
    const symbols = [
      // Mega caps
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
      // Tech
      'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'NFLX',
      // Finance
      'JPM', 'BAC', 'WFC', 'GS', 'MS',
      // Healthcare
      'JNJ', 'UNH', 'PFE', 'ABBV', 'LLY',
      // Consumer
      'WMT', 'HD', 'NKE', 'SBUX', 'MCD',
      // Industrial
      'BA', 'CAT', 'GE', 'HON'
    ];

    return this.scanSymbols(symbols, scanType);
  }
}

export const marketScannerAgent = new MarketScannerAgent();

