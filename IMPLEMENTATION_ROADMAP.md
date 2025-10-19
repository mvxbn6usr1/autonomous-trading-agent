# Implementation Roadmap - Closing the Vision Gaps

**Goal**: Achieve 95%+ alignment with vision document  
**Timeline**: 4-6 months  
**Current Status**: 70% → Target: 95%

---

## Phase 1: Critical Safety Features (Weeks 1-6)

**Priority**: 🔴 **CRITICAL** - Must complete before live trading with real money  
**Effort**: 6 weeks  
**Resources**: 1-2 developers

### 1.1 Backtesting Framework (Week 1-4)

**Implementation Strategy**: Port Backtrader concepts to TypeScript

```typescript
// server/services/backtesting/backtestEngine.ts

import { Strategy } from '../../drizzle/schema';
import { AgentOrchestrator } from '../agents';
import { MarketDataService } from '../marketData';

export interface BacktestConfig {
  strategyId: string;
  symbols: string[];
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commission: number; // per trade
}

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  trades: BacktestTrade[];
  equityCurve: { date: Date; value: number }[];
}

export class BacktestEngine {
  private agents: AgentOrchestrator;
  private marketData: MarketDataService;
  
  constructor() {
    this.agents = new AgentOrchestrator();
    this.marketData = new MarketDataService();
  }
  
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const { startDate, endDate, symbols, initialCapital } = config;
    
    // 1. Load historical data
    const historicalData = await this.loadHistoricalData(symbols, startDate, endDate);
    
    // 2. Initialize portfolio state
    let portfolio = {
      cash: initialCapital,
      positions: new Map(),
      equity: initialCapital
    };
    
    const trades: BacktestTrade[] = [];
    const equityCurve: { date: Date; value: number }[] = [];
    
    // 3. Event-driven simulation
    for (const bar of historicalData) {
      // Update portfolio value
      portfolio.equity = this.calculatePortfolioValue(portfolio, bar.prices);
      equityCurve.push({ date: bar.date, value: portfolio.equity });
      
      // Run agent analysis
      for (const symbol of symbols) {
        const decision = await this.agents.analyze({
          symbol,
          currentPrice: bar.prices[symbol],
          indicators: bar.indicators[symbol],
          // ... other context
        });
        
        // Execute trade if approved
        if (decision.action !== 'hold') {
          const trade = await this.simulateTrade(
            decision,
            bar.prices[symbol],
            portfolio,
            config.commission
          );
          trades.push(trade);
        }
      }
      
      // Check stop-loss / take-profit
      this.checkExitConditions(portfolio, bar.prices, trades);
    }
    
    // 4. Calculate performance metrics
    return this.calculateMetrics(trades, equityCurve, initialCapital);
  }
  
  private async simulateTrade(
    decision: TradeDecision,
    price: number,
    portfolio: Portfolio,
    commission: number
  ): Promise<BacktestTrade> {
    // Realistic fill simulation with slippage
    const slippage = price * 0.001; // 0.1% slippage
    const fillPrice = decision.action === 'buy' 
      ? price + slippage 
      : price - slippage;
    
    // ... trade execution logic
    
    return {
      date: new Date(),
      symbol: decision.symbol,
      action: decision.action,
      quantity: decision.quantity,
      price: fillPrice,
      commission,
      pnl: 0 // calculated on exit
    };
  }
  
  private calculateMetrics(
    trades: BacktestTrade[],
    equityCurve: { date: Date; value: number }[],
    initialCapital: number
  ): BacktestResult {
    // Sharpe ratio calculation
    const returns = equityCurve.map((point, i) => {
      if (i === 0) return 0;
      return (point.value - equityCurve[i-1].value) / equityCurve[i-1].value;
    });
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(
      returns.map(r => Math.pow(r - avgReturn, 2))
             .reduce((a, b) => a + b, 0) / returns.length
    );
    const sharpeRatio = (avgReturn / stdReturn) * Math.sqrt(252); // annualized
    
    // Max drawdown
    let maxDrawdown = 0;
    let peak = initialCapital;
    for (const point of equityCurve) {
      if (point.value > peak) peak = point.value;
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Win rate
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const winRate = winningTrades / trades.length;
    
    // Profit factor
    const grossProfit = trades.filter(t => t.pnl > 0)
                              .reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(
      trades.filter(t => t.pnl < 0)
            .reduce((sum, t) => sum + t.pnl, 0)
    );
    const profitFactor = grossProfit / grossLoss;
    
    const finalValue = equityCurve[equityCurve.length - 1].value;
    const totalReturn = (finalValue - initialCapital) / initialCapital;
    
    return {
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      totalTrades: trades.length,
      profitFactor,
      trades,
      equityCurve
    };
  }
}
```

**Deliverables**:
- [ ] `server/services/backtesting/backtestEngine.ts` - Core engine
- [ ] `server/services/backtesting/types.ts` - Type definitions
- [ ] `server/services/backtesting/metrics.ts` - Performance calculations
- [ ] `server/services/backtesting/slippage.ts` - Realistic fills
- [ ] `test-backtest.ts` - Validation script
- [ ] tRPC endpoints for backtesting
- [ ] Frontend UI for backtest results

**Success Criteria**:
- Can backtest strategy on 3 months of historical data
- Generates Sharpe ratio, max drawdown, win rate
- Equity curve visualization
- Trade-by-trade analysis

---

### 1.2 Automated Test Suite (Week 5-6)

**Implementation Strategy**: Comprehensive test coverage with Vitest

```typescript
// server/services/agents.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { runTechnicalAnalyst } from './agents';
import { TechnicalIndicators } from './marketData';

describe('Technical Analyst Agent', () => {
  let context: AgentContext;
  
  beforeEach(() => {
    context = {
      symbol: 'AAPL',
      currentPrice: 150.00,
      indicators: {
        rsi: 45,
        macd: { macd: 0.5, signal: 0.3, histogram: 0.2 },
        bollingerBands: { upper: 155, middle: 150, lower: 145 },
        sma20: 149,
        sma50: 148,
        ema12: 150.5,
        ema26: 149.5,
        atr: 2.5
      },
      strategy: {
        riskLevel: 'medium',
        maxPositionSize: 5,
        stopLossPercent: 2
      }
    };
  });
  
  it('should return buy signal when RSI is oversold', async () => {
    context.indicators.rsi = 25; // oversold
    
    const result = await runTechnicalAnalyst(context);
    
    expect(result.recommendation).toBe('buy');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.signals.rsi.signal).toBe('oversold');
  });
  
  it('should return sell signal when RSI is overbought', async () => {
    context.indicators.rsi = 75; // overbought
    
    const result = await runTechnicalAnalyst(context);
    
    expect(result.recommendation).toBe('sell');
    expect(result.signals.rsi.signal).toBe('overbought');
  });
  
  it('should have high confidence when multiple signals align', async () => {
    context.indicators.rsi = 30; // oversold
    context.indicators.macd.histogram = 0.5; // bullish
    context.currentPrice = context.indicators.bollingerBands.lower; // at lower band
    
    const result = await runTechnicalAnalyst(context);
    
    expect(result.recommendation).toBe('buy');
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});

// server/services/riskManagement.test.ts

describe('Risk Management', () => {
  describe('Position Sizing', () => {
    it('should calculate correct position size with 2% risk', () => {
      const signal = { action: 'buy', confidence: 0.8 };
      const currentPrice = 100;
      const accountValue = 10000;
      
      const result = calculatePositionSize(signal, currentPrice, accountValue, 2, 2.5);
      
      expect(result.riskAmount).toBe(200); // 2% of $10k
      expect(result.quantity).toBeGreaterThan(0);
      expect(result.stopLoss).toBeLessThan(currentPrice);
      expect(result.takeProfit).toBeGreaterThan(currentPrice);
    });
    
    it('should limit position to max 10% of portfolio', () => {
      const signal = { action: 'buy', confidence: 0.8 };
      const currentPrice = 10; // cheap stock
      const accountValue = 10000;
      
      const result = calculatePositionSize(signal, currentPrice, accountValue, 5, 0.5);
      
      expect(result.positionValue).toBeLessThanOrEqual(1000); // max 10%
    });
  });
  
  describe('Daily Loss Limit', () => {
    it('should trigger circuit breaker at 10% daily loss', async () => {
      const trades = [
        { pnl: -500, date: new Date() },
        { pnl: -500, date: new Date() }
      ];
      
      const result = await checkDailyLossLimit('strategy-1', 10000, 10);
      
      expect(result.limitReached).toBe(true);
      expect(result.action).toBe('halt_trading');
    });
  });
});

// server/services/tradingOrchestrator.test.ts

describe('Trading Orchestrator', () => {
  it('should execute complete trading cycle', async () => {
    const orchestrator = new TradingOrchestrator();
    
    const result = await orchestrator.runTradingCycle(
      'strategy-1',
      'AAPL',
      10000,
      mockStrategy
    );
    
    expect(result.agentsAnalyzed).toBe(7);
    expect(result.decision).toBeDefined();
    expect(result.riskChecked).toBe(true);
  });
  
  it('should reject trade when risk manager vetoes', async () => {
    // ... test veto authority
  });
});
```

**Test Coverage Goals**:
```
✅ Unit Tests
   - agents.test.ts (all 7 agents)
   - riskManagement.test.ts (position sizing, limits)
   - marketData.test.ts (indicators, data fetching)
   - brokers/alpacaBroker.test.ts (order execution)
   - portfolioOrchestrator.test.ts (portfolio logic)

✅ Integration Tests
   - tradingOrchestrator.integration.test.ts (full flow)
   - agentCoordination.integration.test.ts (multi-agent)
   - brokerIntegration.integration.test.ts (real API calls)

✅ E2E Tests
   - completeTradingCycle.e2e.test.ts (end-to-end)
   - riskCircuitBreaker.e2e.test.ts (safety mechanisms)
   - portfolioRebalancing.e2e.test.ts (portfolio mgmt)

Target: 80%+ code coverage
```

**Deliverables**:
- [ ] 50+ unit tests covering core services
- [ ] 10+ integration tests for workflows
- [ ] 5+ E2E tests for critical paths
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Code coverage reporting (Codecov)
- [ ] Pre-commit hooks running tests

---

### 1.3 Pattern Day Trader Tracking (Week 5-6)

```typescript
// server/services/compliance/pdtTracker.ts

export interface PDTStatus {
  isDayTrader: boolean;
  dayTradesLast5Days: number;
  daysUntilReset: number;
  accountValue: number;
  pdtMinimum: number;
  canDayTrade: boolean;
  warning?: string;
}

export class PatternDayTraderService {
  async checkPDTStatus(userId: string, strategyId: string): Promise<PDTStatus> {
    // Get last 5 business days of trades
    const trades = await this.getRecentTrades(userId, strategyId, 5);
    
    // Count day trades (buy and sell same day)
    const dayTrades = this.countDayTrades(trades);
    
    // Get account value
    const broker = getBroker();
    const account = await broker.getAccount();
    
    const pdtMinimum = 25000; // $25,000 FINRA requirement
    const isDayTrader = dayTrades >= 4;
    const canDayTrade = account.portfolioValue >= pdtMinimum;
    
    let warning: string | undefined;
    if (dayTrades === 3) {
      warning = 'One more day trade will classify you as a Pattern Day Trader';
    } else if (isDayTrader && !canDayTrade) {
      warning = 'Pattern Day Trader restriction - account must have $25,000 minimum';
    }
    
    return {
      isDayTrader,
      dayTradesLast5Days: dayTrades,
      daysUntilReset: this.calculateResetDays(trades),
      accountValue: account.portfolioValue,
      pdtMinimum,
      canDayTrade,
      warning
    };
  }
  
  async validateDayTrade(userId: string, strategyId: string, symbol: string): Promise<boolean> {
    // Check if this would be a day trade
    const existingPosition = await this.getPositionOpenedToday(strategyId, symbol);
    if (!existingPosition) {
      return true; // Not a day trade
    }
    
    // Check PDT status
    const status = await this.checkPDTStatus(userId, strategyId);
    
    if (status.dayTradesLast5Days >= 3 && !status.canDayTrade) {
      // Would violate PDT rule
      await this.createPDTAlert(userId, strategyId);
      return false;
    }
    
    return true;
  }
  
  private countDayTrades(trades: Order[]): number {
    const dayTrades = new Map<string, { buy?: Date; sell?: Date }>();
    
    for (const trade of trades) {
      const dateKey = trade.createdAt.toDateString();
      const key = `${dateKey}-${trade.symbol}`;
      
      if (!dayTrades.has(key)) {
        dayTrades.set(key, {});
      }
      
      const dayTrade = dayTrades.get(key)!;
      if (trade.side === 'buy') {
        dayTrade.buy = trade.createdAt;
      } else {
        dayTrade.sell = trade.createdAt;
      }
    }
    
    // Count pairs (buy and sell on same day)
    let count = 0;
    for (const [_, trade] of dayTrades) {
      if (trade.buy && trade.sell) {
        count++;
      }
    }
    
    return count;
  }
}
```

**Deliverables**:
- [ ] PDT tracking service
- [ ] Pre-trade PDT validation
- [ ] PDT alerts and warnings
- [ ] Frontend PDT status display
- [ ] Automatic trade blocking when PDT limit reached

---

## Phase 2: Performance & Infrastructure (Weeks 7-12)

**Priority**: 🟡 **HIGH** - Needed for production scale  
**Effort**: 6 weeks  
**Resources**: 1-2 developers

### 2.1 TimescaleDB for Time-Series (Week 7-8)

```sql
-- migrations/001_timescaledb.sql

-- Create hypertable for market data
CREATE TABLE market_data_ts (
    time TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    open DECIMAL NOT NULL,
    high DECIMAL NOT NULL,
    low DECIMAL NOT NULL,
    close DECIMAL NOT NULL,
    volume BIGINT NOT NULL
);

SELECT create_hypertable('market_data_ts', 'time');

-- Create continuous aggregate for 5-minute bars
CREATE MATERIALIZED VIEW market_data_5min
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('5 minutes', time) AS bucket,
    symbol,
    FIRST(open, time) AS open,
    MAX(high) AS high,
    MIN(low) AS low,
    LAST(close, time) AS close,
    SUM(volume) AS volume
FROM market_data_ts
GROUP BY bucket, symbol;

-- Automatic refresh every 1 minute
SELECT add_continuous_aggregate_policy('market_data_5min',
    start_offset => INTERVAL '10 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- Compression policy (compress data older than 7 days)
SELECT add_compression_policy('market_data_ts', INTERVAL '7 days');

-- Retention policy (delete data older than 2 years)
SELECT add_retention_policy('market_data_ts', INTERVAL '2 years');
```

**Benefits**:
- 6.5x faster ingestion than InfluxDB
- Automatic compression (90% storage savings)
- Continuous aggregates for real-time indicators
- Efficient time-range queries

---

### 2.2 Redis Caching Layer (Week 9)

```typescript
// server/services/cache.ts

import Redis from 'ioredis';

class CacheService {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  
  // Market data caching
  async getCachedPrice(symbol: string): Promise<number | null> {
    const cached = await this.redis.get(`price:${symbol}`);
    return cached ? parseFloat(cached) : null;
  }
  
  async cachePrice(symbol: string, price: number, ttl: number = 60) {
    await this.redis.setex(`price:${symbol}`, ttl, price.toString());
  }
  
  // Technical indicators caching
  async getCachedIndicators(symbol: string): Promise<TechnicalIndicators | null> {
    const cached = await this.redis.get(`indicators:${symbol}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  async cacheIndicators(symbol: string, indicators: TechnicalIndicators, ttl: number = 300) {
    await this.redis.setex(`indicators:${symbol}`, ttl, JSON.stringify(indicators));
  }
  
  // Agent decision caching (prevent repeated calls)
  async getCachedAgentDecision(agentType: string, symbol: string): Promise<any | null> {
    const cached = await this.redis.get(`agent:${agentType}:${symbol}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  async cacheAgentDecision(agentType: string, symbol: string, decision: any, ttl: number = 60) {
    await this.redis.setex(`agent:${agentType}:${symbol}`, ttl, JSON.stringify(decision));
  }
  
  // Rate limiting
  async checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    return current <= limit;
  }
}

export const cache = new CacheService();
```

**Benefits**:
- Sub-millisecond data access
- Reduces API calls by 80%+ (cost savings)
- Rate limit protection
- Agent decision caching

---

### 2.3 Prometheus + Grafana Monitoring (Week 10-11)

```typescript
// server/services/monitoring/prometheus.ts

import client from 'prom-client';

// Create metrics registry
const register = new client.Registry();

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom trading metrics
export const metrics = {
  // Order metrics
  ordersPlaced: new client.Counter({
    name: 'trading_orders_placed_total',
    help: 'Total number of orders placed',
    labelNames: ['symbol', 'side', 'strategy_id'],
    registers: [register]
  }),
  
  ordersFilled: new client.Counter({
    name: 'trading_orders_filled_total',
    help: 'Total number of orders filled',
    labelNames: ['symbol', 'side'],
    registers: [register]
  }),
  
  ordersRejected: new client.Counter({
    name: 'trading_orders_rejected_total',
    help: 'Total number of orders rejected',
    labelNames: ['reason', 'strategy_id'],
    registers: [register]
  }),
  
  // Position metrics
  positionsOpen: new client.Gauge({
    name: 'trading_positions_open',
    help: 'Number of open positions',
    labelNames: ['strategy_id'],
    registers: [register]
  }),
  
  portfolioValue: new client.Gauge({
    name: 'trading_portfolio_value_usd',
    help: 'Total portfolio value in USD',
    labelNames: ['strategy_id'],
    registers: [register]
  }),
  
  unrealizedPnL: new client.Gauge({
    name: 'trading_unrealized_pnl_usd',
    help: 'Unrealized P&L in USD',
    labelNames: ['strategy_id'],
    registers: [register]
  }),
  
  // Agent metrics
  agentDecisionTime: new client.Histogram({
    name: 'trading_agent_decision_seconds',
    help: 'Time taken for agent decisions',
    labelNames: ['agent_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register]
  }),
  
  agentConsensus: new client.Gauge({
    name: 'trading_agent_consensus',
    help: 'Agent consensus score (0-1)',
    labelNames: ['strategy_id', 'symbol'],
    registers: [register]
  }),
  
  // Risk metrics
  riskScoreViolations: new client.Counter({
    name: 'trading_risk_violations_total',
    help: 'Total number of risk violations',
    labelNames: ['violation_type', 'strategy_id'],
    registers: [register]
  }),
  
  dailyLossPercent: new client.Gauge({
    name: 'trading_daily_loss_percent',
    help: 'Daily loss as percentage',
    labelNames: ['strategy_id'],
    registers: [register]
  }),
  
  // API metrics
  apiCallDuration: new client.Histogram({
    name: 'trading_api_call_seconds',
    help: 'API call duration',
    labelNames: ['endpoint', 'method'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
    registers: [register]
  })
};

// Metrics endpoint
export function getMetrics() {
  return register.metrics();
}
```

**Grafana Dashboard**:
```json
{
  "dashboard": {
    "title": "Autonomous Trading Agent",
    "panels": [
      {
        "title": "Portfolio Value",
        "type": "graph",
        "query": "trading_portfolio_value_usd"
      },
      {
        "title": "Open Positions",
        "type": "stat",
        "query": "trading_positions_open"
      },
      {
        "title": "Daily P&L",
        "type": "graph",
        "query": "rate(trading_unrealized_pnl_usd[1h])"
      },
      {
        "title": "Order Fill Rate",
        "type": "gauge",
        "query": "trading_orders_filled_total / trading_orders_placed_total"
      },
      {
        "title": "Agent Decision Time",
        "type": "heatmap",
        "query": "trading_agent_decision_seconds"
      },
      {
        "title": "Risk Violations",
        "type": "graph",
        "query": "rate(trading_risk_violations_total[5m])"
      }
    ]
  }
}
```

---

### 2.4 Market Abuse Surveillance (Week 12)

```typescript
// server/services/compliance/surveillance.ts

export class MarketAbuseSurveillance {
  // Wash trading detection
  async detectWashTrading(userId: string, timeWindow: number = 3600000): Promise<Alert[]> {
    const trades = await this.getRecentTrades(userId, timeWindow);
    const alerts: Alert[] = [];
    
    // Group by symbol
    const bySymbol = new Map<string, Order[]>();
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
          const timeDiff = Math.abs(sell.createdAt.getTime() - buy.createdAt.getTime());
          const priceDiff = Math.abs(sell.filledPrice - buy.filledPrice) / buy.filledPrice;
          
          // Suspicion: offsetting trades within 1 hour at similar prices
          if (timeDiff < 3600000 && priceDiff < 0.01 && buy.quantity === sell.quantity) {
            alerts.push({
              type: 'wash_trading',
              severity: 'high',
              description: `Potential wash trading detected in ${symbol}`,
              trades: [buy.id, sell.id]
            });
          }
        }
      }
    }
    
    return alerts;
  }
  
  // Layering/spoofing detection
  async detectLayering(userId: string): Promise<Alert[]> {
    // Detect placing large orders then canceling after market moves
    const orders = await this.getRecentOrders(userId, 300000); // 5 minutes
    const alerts: Alert[] = [];
    
    const cancelled = orders.filter(o => o.status === 'cancelled');
    const filled = orders.filter(o => o.status === 'filled');
    
    if (cancelled.length > 5 && filled.length > 0) {
      // High cancellation rate + some fills = potential layering
      alerts.push({
        type: 'layering',
        severity: 'medium',
        description: 'High order cancellation rate with filled orders',
        stats: { cancelled: cancelled.length, filled: filled.length }
      });
    }
    
    return alerts;
  }
  
  // Front-running detection
  async detectFrontRunning(userId: string): Promise<Alert[]> {
    // Detect trading ahead of large client orders
    // (Not applicable for retail but good practice)
    return [];
  }
  
  // Excessive trading velocity
  async detectExcessiveVelocity(userId: string): Promise<Alert[]> {
    const trades = await this.getRecentTrades(userId, 60000); // 1 minute
    const alerts: Alert[] = [];
    
    if (trades.length > 50) {
      alerts.push({
        type: 'excessive_velocity',
        severity: 'medium',
        description: `Abnormally high trading velocity: ${trades.length} trades/minute`
      });
    }
    
    return alerts;
  }
  
  // Master surveillance check
  async runSurveillance(userId: string): Promise<SurveillanceReport> {
    const [washTrading, layering, velocity] = await Promise.all([
      this.detectWashTrading(userId),
      this.detectLayering(userId),
      this.detectExcessiveVelocity(userId)
    ]);
    
    const allAlerts = [...washTrading, ...layering, ...velocity];
    
    // Auto-report to compliance if high severity
    const highSeverity = allAlerts.filter(a => a.severity === 'high');
    if (highSeverity.length > 0) {
      await this.reportToCompliance(userId, highSeverity);
    }
    
    return {
      userId,
      timestamp: new Date(),
      alerts: allAlerts,
      summary: {
        total: allAlerts.length,
        high: highSeverity.length,
        medium: allAlerts.filter(a => a.severity === 'medium').length
      }
    };
  }
}
```

---

## Phase 3: Advanced Agent Features (Weeks 13-18)

**Priority**: 🟢 **MEDIUM** - Improves agent quality over time  
**Effort**: 6 weeks  
**Resources**: 1 developer

### 3.1 ReAct Framework (Week 13-15)

```typescript
// server/services/agents/react/reactAgent.ts

export interface ReActStep {
  thought: string;
  action: {
    tool: string;
    input: any;
  };
  observation: string;
}

export class ReActAgent {
  private llm: AgentLLM;
  private tools: Map<string, Tool>;
  private maxIterations: number = 5;
  
  constructor(agentType: string) {
    this.llm = new AgentLLM(agentType);
    this.tools = this.initializeTools();
  }
  
  async execute(prompt: string, context: any): Promise<AgentResponse> {
    const history: ReActStep[] = [];
    
    for (let i = 0; i < this.maxIterations; i++) {
      // Step 1: Think
      const thought = await this.think(prompt, context, history);
      console.log(`[ReAct] Thought: ${thought}`);
      
      // Step 2: Act (choose tool and execute)
      const action = await this.act(thought);
      console.log(`[ReAct] Action: ${action.tool}(${JSON.stringify(action.input)})`);
      
      // Step 3: Observe (get result)
      const observation = await this.observe(action);
      console.log(`[ReAct] Observation: ${observation}`);
      
      history.push({ thought, action, observation });
      
      // Check if done
      if (action.tool === 'final_answer') {
        return {
          answer: observation,
          reasoning: history.map(step => step.thought).join(' → '),
          steps: history
        };
      }
    }
    
    // Max iterations reached
    return {
      answer: 'Unable to reach conclusion',
      reasoning: 'Max iterations exceeded',
      steps: history
    };
  }
  
  private async think(prompt: string, context: any, history: ReActStep[]): Promise<string> {
    const historyText = history
      .map(step => `Thought: ${step.thought}\nAction: ${step.action.tool}\nObservation: ${step.observation}`)
      .join('\n\n');
    
    const thinkPrompt = `
You are a trading analyst. Think step by step about what information you need.

Context: ${JSON.stringify(context)}

Available tools:
- fetch_price(symbol) - Get current price
- calculate_rsi(symbol, period) - Calculate RSI
- get_news(symbol) - Get recent news
- final_answer(reasoning) - Provide final recommendation

Previous steps:
${historyText}

What do you need to do next? Think aloud.
    `;
    
    const response = await this.llm.generateText(thinkPrompt);
    return response;
  }
  
  private async act(thought: string): Promise<{ tool: string; input: any }> {
    // Parse thought to extract action
    const actionPrompt = `
Based on this thought: "${thought}"

Which tool should be called and with what input?

Respond in JSON:
{
  "tool": "tool_name",
  "input": { ... }
}
    `;
    
    const response = await this.llm.generateStructured(actionPrompt, {
      type: 'object',
      properties: {
        tool: { type: 'string' },
        input: { type: 'object' }
      }
    });
    
    return response;
  }
  
  private async observe(action: { tool: string; input: any }): Promise<string> {
    const tool = this.tools.get(action.tool);
    if (!tool) {
      return `Error: Tool ${action.tool} not found`;
    }
    
    try {
      const result = await tool.execute(action.input);
      return JSON.stringify(result);
    } catch (error) {
      return `Error executing tool: ${error.message}`;
    }
  }
  
  private initializeTools(): Map<string, Tool> {
    return new Map([
      ['fetch_price', {
        execute: async (input) => {
          const price = await marketData.getCurrentPrice(input.symbol);
          return { symbol: input.symbol, price };
        }
      }],
      ['calculate_rsi', {
        execute: async (input) => {
          const indicators = await marketData.getTechnicalIndicators(input.symbol);
          return { symbol: input.symbol, rsi: indicators.rsi };
        }
      }],
      ['get_news', {
        execute: async (input) => {
          // Fetch recent news for symbol
          return { news: [] };
        }
      }],
      ['final_answer', {
        execute: async (input) => input.reasoning
      }]
    ]);
  }
}
```

---

### 3.2 Layered Memory Architecture (Week 16-18)

```typescript
// server/services/agents/memory/layeredMemory.ts

import { VectorStore } from './vectorStore';
import { Database } from './database';

export class LayeredMemory {
  private workingMemory: Map<string, any>; // Current session
  private episodicMemory: VectorStore; // Recent trades (vector DB)
  private longTermMemory: Database; // Historical patterns (SQL)
  private reflectionMemory: ReflectionStore; // Learned lessons
  
  constructor() {
    this.workingMemory = new Map();
    this.episodicMemory = new VectorStore('episodic');
    this.longTermMemory = new Database();
    this.reflectionMemory = new ReflectionStore();
  }
  
  // Store a trading experience
  async storeExperience(experience: TradingExperience) {
    // Working memory (immediate)
    this.workingMemory.set(experience.id, experience);
    
    // Episodic memory (embedded in vector DB for similarity search)
    const embedding = await this.embedExperience(experience);
    await this.episodicMemory.store(experience.id, embedding, experience);
    
    // Long-term memory (structured storage)
    await this.longTermMemory.insert('experiences', experience);
  }
  
  // Retrieve relevant memories
  async retrieveRelevant(query: string, k: number = 5): Promise<TradingExperience[]> {
    const queryEmbedding = await this.embedQuery(query);
    
    // Search episodic memory for similar experiences
    const similar = await this.episodicMemory.search(queryEmbedding, k);
    
    // Score by recency, relevance, importance
    const scored = similar.map(exp => ({
      experience: exp,
      score: this.calculateMemoryScore(exp, queryEmbedding)
    }));
    
    // Sort by score and return top k
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(s => s.experience);
  }
  
  // Memory scoring: recency + relevance + importance
  private calculateMemoryScore(
    experience: TradingExperience,
    queryEmbedding: number[]
  ): number {
    // Recency score (exponential decay)
    const ageHours = (Date.now() - experience.timestamp.getTime()) / 3600000;
    const recencyScore = Math.exp(-ageHours / 168); // decay over 1 week
    
    // Relevance score (cosine similarity)
    const relevanceScore = this.cosineSimilarity(
      experience.embedding,
      queryEmbedding
    );
    
    // Importance score (based on P&L impact)
    const importanceScore = Math.abs(experience.pnl) / 1000; // normalize
    
    // Weighted combination
    return (
      0.3 * recencyScore +
      0.5 * relevanceScore +
      0.2 * importanceScore
    );
  }
  
  // Agent reflection mechanism
  async reflect(agentType: string, period: 'daily' | 'weekly' | 'monthly') {
    // Get recent experiences
    const experiences = await this.getRecentExperiences(agentType, period);
    
    // Analyze patterns
    const patterns = this.analyzePatterns(experiences);
    
    // Generate reflection
    const reflection = await this.generateReflection(agentType, patterns);
    
    // Store in reflection memory
    await this.reflectionMemory.store({
      agentType,
      timestamp: new Date(),
      patterns,
      reflection,
      lessons: reflection.lessons
    });
    
    return reflection;
  }
  
  private async generateReflection(
    agentType: string,
    patterns: any
  ): Promise<Reflection> {
    const prompt = `
You are the ${agentType} agent. Reflect on your recent trading decisions.

Patterns observed:
${JSON.stringify(patterns, null, 2)}

What worked well? What didn't? What should you change?

Respond with:
{
  "successes": ["list of what worked"],
  "failures": ["list of what didn't work"],
  "lessons": ["key lessons learned"],
  "adjustments": ["changes to make going forward"]
}
    `;
    
    const llm = new AgentLLM(agentType);
    return await llm.generateStructured(prompt, reflectionSchema);
  }
}
```

---

## Phase 4: Optional Enhancements (Weeks 19-24)

**Priority**: 🟢 **LOW** - Nice to have, not critical  
**Effort**: 6 weeks  
**Resources**: 1 developer

### 4.1 Interactive Brokers Integration
### 4.2 UK Market Support (LSE)
### 4.3 Crypto DEX (Hyperliquid)
### 4.4 Kafka Event Streaming

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] Backtest shows positive Sharpe ratio > 1.0 on 6 months historical data
- [ ] 80%+ code coverage with passing tests
- [ ] PDT tracking prevents violations
- [ ] CI/CD pipeline running on every commit

### Phase 2 Success Criteria
- [ ] TimescaleDB handles 10k+ data points/second
- [ ] Redis reduces API calls by 80%+
- [ ] Grafana dashboard shows real-time metrics
- [ ] Market abuse surveillance runs without false positives

### Phase 3 Success Criteria
- [ ] ReAct agents show reasoning transparency
- [ ] Memory system improves decisions over 30 days
- [ ] Reflection generates actionable insights weekly
- [ ] Agent performance improves month-over-month

---

## Risk Mitigation

### Technical Risks
- **Risk**: Backtesting framework too complex  
  **Mitigation**: Start simple, iterate based on needs
  
- **Risk**: TimescaleDB migration breaks existing data  
  **Mitigation**: Run in parallel, validate before switching
  
- **Risk**: Redis single point of failure  
  **Mitigation**: Use Redis Sentinel for high availability

### Business Risks
- **Risk**: User loses money due to bugs  
  **Mitigation**: Extensive testing, paper trading first, gradual rollout
  
- **Risk**: Regulatory violation  
  **Mitigation**: Legal review, comprehensive audit logs, surveillance

---

## Resource Requirements

### Development Team
- 1-2 Full-stack developers (TypeScript/Node.js)
- 1 DevOps engineer (part-time for infrastructure)
- 1 QA engineer (for comprehensive testing)

### Infrastructure Costs
- **TimescaleDB**: $50-200/month (managed service)
- **Redis**: $30-100/month (managed service)
- **Prometheus + Grafana**: $50-150/month (hosted)
- **CI/CD**: $0 (GitHub Actions free tier)
- **Total**: ~$150-500/month

### Time Investment
- Phase 1: 6 weeks (240 hours)
- Phase 2: 6 weeks (240 hours)
- Phase 3: 6 weeks (240 hours)
- **Total**: 18 weeks (720 hours) for Phases 1-3

---

## Conclusion

This roadmap prioritizes **critical safety features first** (backtesting, testing, PDT tracking), then **performance infrastructure** (TimescaleDB, Redis, monitoring), and finally **advanced agent capabilities** (ReAct, memory, reflection).

**Timeline**: 18 weeks (4.5 months) to reach 95%+ vision alignment  
**Cost**: ~$150-500/month infrastructure + development time  
**Risk**: Low (phased approach with validation at each step)

**Expected Outcome**: A **production-grade autonomous trading platform** that matches or exceeds the vision document, with bulletproof safety, institutional-scale infrastructure, and learning agents that improve over time.

