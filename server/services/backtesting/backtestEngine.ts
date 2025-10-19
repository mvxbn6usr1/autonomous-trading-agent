// Core backtesting engine

import { 
  BacktestConfig, 
  BacktestResult, 
  BacktestTrade, 
  Portfolio, 
  Position, 
  MarketDataBar,
  BacktestProgress 
} from './types';
import { 
  calculateSharpeRatio, 
  calculateMaxDrawdown, 
  calculateWinRate, 
  calculateProfitFactor,
  calculateTotalReturn,
  calculateMonthlyReturns,
  calculateAnnualizedReturn
} from './metrics';
import { simulateOrderFill, DEFAULT_SLIPPAGE_CONFIG, SlippageConfig } from './slippage';
import { AgentOrchestrator } from '../agents';
import { enhancedDataProvider } from '../marketData/enhancedDataProvider';

export class BacktestEngine {
  private config: BacktestConfig;
  private portfolio: Portfolio;
  private trades: BacktestTrade[] = [];
  private equityCurve: { date: Date; value: number }[] = [];
  private agents: AgentOrchestrator;
  private slippageConfig: SlippageConfig;
  private onProgress?: (progress: BacktestProgress) => void;

  constructor(
    config: BacktestConfig,
    slippageConfig: SlippageConfig = DEFAULT_SLIPPAGE_CONFIG,
    onProgress?: (progress: BacktestProgress) => void
  ) {
    this.config = config;
    this.slippageConfig = slippageConfig;
    this.onProgress = onProgress;
    this.portfolio = {
      cash: config.initialCapital,
      positions: new Map(),
      equity: config.initialCapital,
    };
    this.agents = new AgentOrchestrator();
  }

  async runBacktest(): Promise<BacktestResult> {
    console.log('[Backtest] Starting backtest...', {
      symbols: this.config.symbols,
      period: `${this.config.startDate.toISOString()} to ${this.config.endDate.toISOString()}`,
      capital: this.config.initialCapital,
    });

    // Load historical data for all symbols
    const historicalData = await this.loadHistoricalData();

    if (historicalData.length === 0) {
      throw new Error('No historical data available for backtesting');
    }

    // Event-driven simulation
    let barIndex = 0;
    for (const bar of historicalData) {
      // Update portfolio value
      this.updatePortfolioValue(bar);
      this.equityCurve.push({ date: bar.date, value: this.portfolio.equity });

      // Check exit conditions for existing positions
      await this.checkExitConditions(bar);

      // Run agent analysis for each symbol
      for (const symbol of this.config.symbols) {
        if (!bar.prices[symbol]) continue;

        // Skip if we already have a position in this symbol
        if (this.portfolio.positions.has(symbol)) continue;

        // Run agent analysis
        const decision = await this.runAgentAnalysis(symbol, bar);

        // Execute trade if agents recommend
        if (decision.action !== 'hold') {
          await this.executeTrade(decision, bar);
        }
      }

      // Progress callback
      barIndex++;
      if (this.onProgress) {
        this.onProgress({
          currentDate: bar.date,
          progress: (barIndex / historicalData.length) * 100,
          tradesExecuted: this.trades.length,
          currentEquity: this.portfolio.equity,
        });
      }
    }

    // Close all remaining positions at end of backtest
    await this.closeAllPositions(historicalData[historicalData.length - 1]);

    // Calculate performance metrics
    return this.calculateMetrics();
  }

  private async loadHistoricalData(): Promise<MarketDataBar[]> {
    console.log('[Backtest] Loading historical data...');
    
    const bars: MarketDataBar[] = [];
    const startDate = new Date(this.config.startDate);
    const endDate = new Date(this.config.endDate);
    
    // Generate date range (trading days only)
    const dates: Date[] = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Skip weekends
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[Backtest] Processing ${dates.length} trading days...`);

    // Load data for each date
    for (const date of dates) {
      const bar: MarketDataBar = {
        date,
        prices: {},
        indicators: {},
        volume: {},
      };

      // Load data for each symbol
      for (const symbol of this.config.symbols) {
        try {
          const data = await enhancedDataProvider.getComprehensiveData(symbol);
          
          if (data.currentPrice && data.technicalIndicators) {
            bar.prices[symbol] = data.currentPrice;
            bar.indicators[symbol] = data.technicalIndicators;
            bar.volume[symbol] = data.technicalIndicators.volume || 1000000;
          }
        } catch (error) {
          console.error(`[Backtest] Error loading data for ${symbol}:`, error);
        }
      }

      // Only add bar if we have data
      if (Object.keys(bar.prices).length > 0) {
        bars.push(bar);
      }
    }

    console.log(`[Backtest] Loaded ${bars.length} bars of historical data`);
    return bars;
  }

  private updatePortfolioValue(bar: MarketDataBar): void {
    let totalPositionValue = 0;

    for (const [symbol, position] of this.portfolio.positions) {
      const currentPrice = bar.prices[symbol];
      if (currentPrice) {
        position.currentPrice = currentPrice;
        position.unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity;
        totalPositionValue += currentPrice * position.quantity;
      }
    }

    this.portfolio.equity = this.portfolio.cash + totalPositionValue;
  }

  private async runAgentAnalysis(symbol: string, bar: MarketDataBar): Promise<any> {
    const indicators = bar.indicators[symbol];
    const currentPrice = bar.prices[symbol];

    // Simple decision logic (in real implementation, would call agents)
    // For backtesting, we'll use technical indicators
    
    if (!indicators) {
      return { action: 'hold', symbol };
    }

    const { rsi, macd, sma20, sma50 } = indicators;

    // Buy signal: RSI oversold + MACD positive + price above SMA20
    if (rsi < 30 && macd?.histogram > 0 && currentPrice > sma20) {
      return {
        action: 'buy',
        symbol,
        confidence: 0.8,
        reason: 'RSI oversold + MACD bullish + above SMA20',
      };
    }

    return { action: 'hold', symbol };
  }

  private async executeTrade(decision: any, bar: MarketDataBar): Promise<void> {
    const { symbol, action } = decision;
    const currentPrice = bar.prices[symbol];
    const indicators = bar.indicators[symbol];

    if (!currentPrice || !indicators) return;

    // Calculate position size (use 10% of equity per position)
    const positionValue = this.portfolio.equity * 0.1;
    const quantity = Math.floor(positionValue / currentPrice);

    if (quantity === 0) return;

    // Simulate order fill with realistic slippage
    const fill = simulateOrderFill(
      action,
      'market',
      quantity,
      undefined,
      currentPrice,
      indicators.volume || 1000000,
      indicators.atr || 2.0,
      this.config.commission,
      this.slippageConfig
    );

    if (!fill.filled) return;

    const totalCost = fill.fillPrice * fill.fillQuantity + fill.commission;

    if (action === 'buy') {
      // Check if we have enough cash
      if (totalCost > this.portfolio.cash) return;

      // Open position
      this.portfolio.positions.set(symbol, {
        symbol,
        quantity: fill.fillQuantity,
        entryPrice: fill.fillPrice,
        entryDate: bar.date,
        currentPrice: fill.fillPrice,
        unrealizedPnL: 0,
      });

      this.portfolio.cash -= totalCost;

      console.log(`[Backtest] BUY ${quantity} ${symbol} @ $${fill.fillPrice.toFixed(2)} (slippage: $${fill.slippage.toFixed(2)})`);
    }
  }

  private async checkExitConditions(bar: MarketDataBar): Promise<void> {
    for (const [symbol, position] of this.portfolio.positions) {
      const currentPrice = bar.prices[symbol];
      if (!currentPrice) continue;

      const pnlPercent = (currentPrice - position.entryPrice) / position.entryPrice;

      // Exit conditions: 10% profit or 5% loss
      const shouldExit = pnlPercent >= 0.10 || pnlPercent <= -0.05;

      if (shouldExit) {
        await this.closePosition(symbol, bar);
      }
    }
  }

  private async closePosition(symbol: string, bar: MarketDataBar): Promise<void> {
    const position = this.portfolio.positions.get(symbol);
    if (!position) return;

    const currentPrice = bar.prices[symbol];
    if (!currentPrice) return;

    const indicators = bar.indicators[symbol];

    // Simulate sell order
    const fill = simulateOrderFill(
      'sell',
      'market',
      position.quantity,
      undefined,
      currentPrice,
      indicators?.volume || 1000000,
      indicators?.atr || 2.0,
      this.config.commission,
      this.slippageConfig
    );

    if (!fill.filled) return;

    const saleProceeds = fill.fillPrice * fill.fillQuantity - fill.commission;
    const pnl = saleProceeds - (position.entryPrice * position.quantity + this.config.commission);

    // Record trade
    this.trades.push({
      date: bar.date,
      symbol,
      action: 'sell',
      quantity: fill.fillQuantity,
      price: fill.fillPrice,
      commission: fill.commission,
      pnl,
      entryPrice: position.entryPrice,
      exitPrice: fill.fillPrice,
    });

    this.portfolio.cash += saleProceeds;
    this.portfolio.positions.delete(symbol);

    console.log(`[Backtest] SELL ${position.quantity} ${symbol} @ $${fill.fillPrice.toFixed(2)} (P&L: $${pnl.toFixed(2)})`);
  }

  private async closeAllPositions(bar: MarketDataBar): Promise<void> {
    console.log('[Backtest] Closing all remaining positions...');
    const symbols = Array.from(this.portfolio.positions.keys());
    for (const symbol of symbols) {
      await this.closePosition(symbol, bar);
    }
  }

  private calculateMetrics(): BacktestResult {
    console.log('[Backtest] Calculating performance metrics...');

    const finalEquity = this.equityCurve[this.equityCurve.length - 1]?.value || this.config.initialCapital;
    const totalReturn = calculateTotalReturn(this.config.initialCapital, finalEquity);

    // Calculate daily returns
    const dailyReturns = this.equityCurve.map((point, i) => {
      if (i === 0) return 0;
      const prevValue = this.equityCurve[i - 1].value;
      return (point.value - prevValue) / prevValue;
    }).slice(1); // Remove first zero return

    const sharpeRatio = calculateSharpeRatio(dailyReturns);
    const maxDrawdown = calculateMaxDrawdown(this.equityCurve);
    const winRate = calculateWinRate(this.trades);
    const profitFactor = calculateProfitFactor(this.trades);
    const monthlyReturns = calculateMonthlyReturns(this.equityCurve);

    const result: BacktestResult = {
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      totalTrades: this.trades.length,
      profitFactor,
      trades: this.trades,
      equityCurve: this.equityCurve,
      dailyReturns,
      monthlyReturns,
    };

    console.log('[Backtest] Results:', {
      totalReturn: `${(totalReturn * 100).toFixed(2)}%`,
      sharpeRatio: sharpeRatio.toFixed(2),
      maxDrawdown: `${(maxDrawdown * 100).toFixed(2)}%`,
      winRate: `${(winRate * 100).toFixed(2)}%`,
      totalTrades: this.trades.length,
      profitFactor: profitFactor.toFixed(2),
    });

    return result;
  }
}
