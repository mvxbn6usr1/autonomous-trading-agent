// Prometheus metrics collection for trading system monitoring

import client from 'prom-client';

// Create metrics registry
const register = new client.Registry();

// Default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

/**
 * Custom trading metrics
 */
export const metrics = {
  // ===== Order Metrics =====
  ordersPlaced: new client.Counter({
    name: 'trading_orders_placed_total',
    help: 'Total number of orders placed',
    labelNames: ['symbol', 'side', 'strategy_id'],
    registers: [register],
  }),

  ordersFilled: new client.Counter({
    name: 'trading_orders_filled_total',
    help: 'Total number of orders filled',
    labelNames: ['symbol', 'side', 'strategy_id'],
    registers: [register],
  }),

  ordersRejected: new client.Counter({
    name: 'trading_orders_rejected_total',
    help: 'Total number of orders rejected',
    labelNames: ['reason', 'strategy_id'],
    registers: [register],
  }),

  ordersCancelled: new client.Counter({
    name: 'trading_orders_cancelled_total',
    help: 'Total number of orders cancelled',
    labelNames: ['symbol', 'strategy_id'],
    registers: [register],
  }),

  // ===== Position Metrics =====
  positionsOpen: new client.Gauge({
    name: 'trading_positions_open',
    help: 'Number of currently open positions',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  positionsClosed: new client.Counter({
    name: 'trading_positions_closed_total',
    help: 'Total number of positions closed',
    labelNames: ['strategy_id', 'outcome'], // outcome: win/loss
    registers: [register],
  }),

  // ===== Portfolio Metrics =====
  portfolioValue: new client.Gauge({
    name: 'trading_portfolio_value_usd',
    help: 'Total portfolio value in USD',
    labelNames: ['strategy_id', 'user_id'],
    registers: [register],
  }),

  unrealizedPnL: new client.Gauge({
    name: 'trading_unrealized_pnl_usd',
    help: 'Unrealized profit/loss in USD',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  realizedPnL: new client.Gauge({
    name: 'trading_realized_pnl_usd',
    help: 'Realized profit/loss in USD',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  cashBalance: new client.Gauge({
    name: 'trading_cash_balance_usd',
    help: 'Available cash balance in USD',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  buyingPower: new client.Gauge({
    name: 'trading_buying_power_usd',
    help: 'Available buying power in USD',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  // ===== Agent Metrics =====
  agentDecisionTime: new client.Histogram({
    name: 'trading_agent_decision_seconds',
    help: 'Time taken for agent decisions',
    labelNames: ['agent_type', 'symbol'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
  }),

  agentDecisions: new client.Counter({
    name: 'trading_agent_decisions_total',
    help: 'Total number of agent decisions',
    labelNames: ['agent_type', 'recommendation'], // recommendation: buy/sell/hold
    registers: [register],
  }),

  agentConsensus: new client.Gauge({
    name: 'trading_agent_consensus_score',
    help: 'Agent consensus score (0-1)',
    labelNames: ['strategy_id', 'symbol'],
    registers: [register],
  }),

  agentConfidence: new client.Histogram({
    name: 'trading_agent_confidence',
    help: 'Agent confidence distribution',
    labelNames: ['agent_type'],
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    registers: [register],
  }),

  // ===== Risk Metrics =====
  riskScoreViolations: new client.Counter({
    name: 'trading_risk_violations_total',
    help: 'Total number of risk violations',
    labelNames: ['violation_type', 'strategy_id'],
    registers: [register],
  }),

  dailyLossPercent: new client.Gauge({
    name: 'trading_daily_loss_percent',
    help: 'Daily loss as percentage of portfolio',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  positionSizes: new client.Histogram({
    name: 'trading_position_size_usd',
    help: 'Distribution of position sizes in USD',
    labelNames: ['strategy_id'],
    buckets: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000],
    registers: [register],
  }),

  stopLossTriggered: new client.Counter({
    name: 'trading_stop_loss_triggered_total',
    help: 'Number of times stop-loss was triggered',
    labelNames: ['symbol', 'strategy_id'],
    registers: [register],
  }),

  takeProfitTriggered: new client.Counter({
    name: 'trading_take_profit_triggered_total',
    help: 'Number of times take-profit was triggered',
    labelNames: ['symbol', 'strategy_id'],
    registers: [register],
  }),

  // ===== API & Performance Metrics =====
  apiCallDuration: new client.Histogram({
    name: 'trading_api_call_seconds',
    help: 'API call duration',
    labelNames: ['endpoint', 'method', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),

  apiCallErrors: new client.Counter({
    name: 'trading_api_call_errors_total',
    help: 'Total number of API call errors',
    labelNames: ['endpoint', 'error_type'],
    registers: [register],
  }),

  brokerApiCalls: new client.Counter({
    name: 'trading_broker_api_calls_total',
    help: 'Total number of broker API calls',
    labelNames: ['broker', 'endpoint'],
    registers: [register],
  }),

  llmApiCalls: new client.Counter({
    name: 'trading_llm_api_calls_total',
    help: 'Total number of LLM API calls',
    labelNames: ['provider', 'model'],
    registers: [register],
  }),

  llmApiCost: new client.Counter({
    name: 'trading_llm_api_cost_usd',
    help: 'Estimated LLM API cost in USD',
    labelNames: ['provider', 'model'],
    registers: [register],
  }),

  // ===== Market Data Metrics =====
  marketDataFetches: new client.Counter({
    name: 'trading_market_data_fetches_total',
    help: 'Total number of market data fetches',
    labelNames: ['provider', 'symbol'],
    registers: [register],
  }),

  marketDataLatency: new client.Histogram({
    name: 'trading_market_data_latency_seconds',
    help: 'Market data fetch latency',
    labelNames: ['provider'],
    buckets: [0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
  }),

  // ===== Strategy Performance Metrics =====
  strategyReturns: new client.Gauge({
    name: 'trading_strategy_return_percent',
    help: 'Strategy return percentage',
    labelNames: ['strategy_id', 'timeframe'], // timeframe: daily/weekly/monthly/all_time
    registers: [register],
  }),

  strategySharpeRatio: new client.Gauge({
    name: 'trading_strategy_sharpe_ratio',
    help: 'Strategy Sharpe ratio',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  strategyMaxDrawdown: new client.Gauge({
    name: 'trading_strategy_max_drawdown_percent',
    help: 'Strategy maximum drawdown percentage',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  strategyWinRate: new client.Gauge({
    name: 'trading_strategy_win_rate',
    help: 'Strategy win rate (0-1)',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  // ===== Compliance Metrics =====
  pdtViolations: new client.Counter({
    name: 'trading_pdt_violations_total',
    help: 'Pattern Day Trader rule violations',
    labelNames: ['strategy_id'],
    registers: [register],
  }),

  complianceAlerts: new client.Counter({
    name: 'trading_compliance_alerts_total',
    help: 'Compliance alerts generated',
    labelNames: ['alert_type', 'severity'],
    registers: [register],
  }),

  // ===== System Health Metrics =====
  tradingLoopExecutions: new client.Counter({
    name: 'trading_loop_executions_total',
    help: 'Total number of trading loop executions',
    labelNames: ['strategy_id', 'status'], // status: success/failure
    registers: [register],
  }),

  tradingLoopDuration: new client.Histogram({
    name: 'trading_loop_duration_seconds',
    help: 'Trading loop execution duration',
    labelNames: ['strategy_id'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [register],
  }),

  cacheHits: new client.Counter({
    name: 'trading_cache_hits_total',
    help: 'Cache hit count',
    labelNames: ['cache_type'], // cache_type: price/indicators/agent
    registers: [register],
  }),

  cacheMisses: new client.Counter({
    name: 'trading_cache_misses_total',
    help: 'Cache miss count',
    labelNames: ['cache_type'],
    registers: [register],
  }),
};

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * Get metrics as JSON
 */
export async function getMetricsJSON(): Promise<any> {
  return await register.getMetricsAsJSON();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

/**
 * Export registry for custom metric creation
 */
export { register };

/**
 * Helper functions for common metric patterns
 */

export function recordOrderPlaced(symbol: string, side: 'buy' | 'sell', strategyId: string): void {
  metrics.ordersPlaced.inc({ symbol, side, strategy_id: strategyId });
}

export function recordOrderFilled(symbol: string, side: 'buy' | 'sell', strategyId: string): void {
  metrics.ordersFilled.inc({ symbol, side, strategy_id: strategyId });
}

export function recordOrderRejected(reason: string, strategyId: string): void {
  metrics.ordersRejected.inc({ reason, strategy_id: strategyId });
}

export function recordAgentDecision(
  agentType: string,
  recommendation: 'buy' | 'sell' | 'hold',
  durationSeconds: number,
  confidence: number,
  symbol?: string
): void {
  metrics.agentDecisions.inc({ agent_type: agentType, recommendation });
  metrics.agentDecisionTime.observe({ agent_type: agentType, symbol: symbol || 'unknown' }, durationSeconds);
  metrics.agentConfidence.observe({ agent_type: agentType }, confidence);
}

export function updatePortfolioMetrics(
  strategyId: string,
  userId: string,
  portfolioValue: number,
  unrealizedPnL: number,
  realizedPnL: number,
  cashBalance: number,
  buyingPower: number
): void {
  metrics.portfolioValue.set({ strategy_id: strategyId, user_id: userId }, portfolioValue);
  metrics.unrealizedPnL.set({ strategy_id: strategyId }, unrealizedPnL);
  metrics.realizedPnL.set({ strategy_id: strategyId }, realizedPnL);
  metrics.cashBalance.set({ strategy_id: strategyId }, cashBalance);
  metrics.buyingPower.set({ strategy_id: strategyId }, buyingPower);
}

export function recordRiskViolation(violationType: string, strategyId: string): void {
  metrics.riskScoreViolations.inc({ violation_type: violationType, strategy_id: strategyId });
}

export function recordCacheHit(cacheType: string): void {
  metrics.cacheHits.inc({ cache_type: cacheType });
}

export function recordCacheMiss(cacheType: string): void {
  metrics.cacheMisses.inc({ cache_type: cacheType });
}
