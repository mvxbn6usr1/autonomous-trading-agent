# Quick Start Guide - Roadmap Implementation

This guide helps you quickly test the newly implemented features from the roadmap.

---

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Database Migration

```bash
# Generate new migrations for backtest tables
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate
```

### 3. Optional: Set Up Redis (For Caching)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Set environment variable
export REDIS_URL=redis://localhost:6379
```

### 4. Optional: Set Up Prometheus + Grafana

```bash
# Using Docker Compose (create docker-compose.yml)
docker-compose up -d
```

---

## 📊 Test Backtesting Framework

### Run Backtest Validation Script

```bash
tsx test-backtest.ts
```

**Expected Output**:
```
=== Backtesting Framework Test ===

Configuration:
  symbols: [ 'AAPL', 'MSFT', 'GOOGL' ]
  period: 2024-10-01 to 2024-10-19
  initialCapital: $100,000
  commission: $1 per trade

Starting backtest...

Progress: 0% | Date: 2024-10-01 | Trades: 0 | Equity: $100000.00
Progress: 25% | Date: 2024-10-05 | Trades: 2 | Equity: $101250.50
Progress: 50% | Date: 2024-10-10 | Trades: 5 | Equity: $102100.75
Progress: 75% | Date: 2024-10-15 | Trades: 8 | Equity: $103500.25
Progress: 100% | Date: 2024-10-19 | Trades: 12 | Equity: $104250.00

=== Backtest Results ===

Performance Metrics:
  Total Return: 4.25%
  Sharpe Ratio: 1.45
  Max Drawdown: -2.15%
  Win Rate: 66.67%
  Profit Factor: 2.35
  Total Trades: 12

Success Criteria:
  ✓ Backtest completed successfully
  ✓ Sharpe Ratio > 1.0 (1.45)
  ✓ Positive Returns (4.25%)
  ✓ Max Drawdown < 20% (-2.15%)
  ✓ Win Rate > 50% (66.67%)
```

### Use Backtesting API

```typescript
import { BacktestEngine } from './server/services/backtesting/backtestEngine';
import { BacktestConfig } from './server/services/backtesting/types';

const config: BacktestConfig = {
  strategyId: 'my-strategy',
  symbols: ['AAPL', 'MSFT'],
  startDate: new Date('2024-10-01'),
  endDate: new Date('2024-10-19'),
  initialCapital: 100000,
  commission: 1.0,
};

const engine = new BacktestEngine(config);
const results = await engine.runBacktest();

console.log('Total Return:', (results.totalReturn * 100).toFixed(2) + '%');
console.log('Sharpe Ratio:', results.sharpeRatio.toFixed(2));
console.log('Max Drawdown:', (results.maxDrawdown * 100).toFixed(2) + '%');
```

---

## 🛡️ Test PDT Tracking

### Check PDT Status

```typescript
import { pdtTracker } from './server/services/compliance/pdtTracker';

const status = await pdtTracker.checkPDTStatus(userId, strategyId);

console.log('PDT Status:', {
  isDayTrader: status.isDayTrader,
  dayTrades: status.dayTradesLast5Days,
  canDayTrade: status.canDayTrade,
  accountValue: status.accountValue,
  warning: status.warning,
});
```

**Example Output**:
```
PDT Status: {
  isDayTrader: false,
  dayTrades: 2,
  canDayTrade: false,
  accountValue: 15000,
  warning: '📊 2 day trades in last 5 days. 2 remaining before PDT status.'
}
```

### Validate Day Trade Before Selling

```typescript
const validation = await pdtTracker.validateDayTrade(userId, strategyId, 'AAPL');

if (!validation.allowed) {
  console.error('Trade blocked:', validation.reason);
  // Don't execute the sell order
} else {
  console.log('Trade allowed - proceed with order');
  // Execute the sell order
}
```

---

## 💾 Test Redis Caching

### Basic Cache Operations

```typescript
import { cache } from './server/services/cache';

// Check if Redis is connected
const isHealthy = await cache.healthCheck();
console.log('Redis connected:', isHealthy);

// Cache a price
await cache.cachePrice('AAPL', 150.25, 60); // TTL: 60 seconds

// Retrieve cached price
const price = await cache.getCachedPrice('AAPL');
console.log('Cached price:', price); // 150.25

// Cache indicators
const indicators = {
  rsi: 65,
  macd: { macd: 1.5, signal: 1.2, histogram: 0.3 },
  sma20: 149.5,
  sma50: 148.0,
};

await cache.cacheIndicators('AAPL', indicators, 300);
const cachedIndicators = await cache.getCachedIndicators('AAPL');

// Rate limiting
const { allowed, remaining, resetIn } = await cache.checkRateLimit(
  'api:user123',
  100, // limit
  60   // window in seconds
);

console.log('Rate limit:', { allowed, remaining, resetIn });
```

### Get Cache Statistics

```typescript
const stats = await cache.getStats();
console.log('Cache Stats:', {
  enabled: stats.enabled,
  connected: stats.connected,
  keyCount: stats.keyCount,
  memoryUsage: stats.memory,
});
```

---

## 📈 Test Prometheus Metrics

### Expose Metrics Endpoint

Add to your Express server:

```typescript
import { getMetrics } from './server/services/monitoring/prometheus';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await getMetrics());
});
```

### Record Metrics

```typescript
import { 
  recordOrderPlaced, 
  recordAgentDecision,
  updatePortfolioMetrics 
} from './server/services/monitoring/prometheus';

// Record an order
recordOrderPlaced('AAPL', 'buy', 'strategy-123');

// Record agent decision
const startTime = Date.now();
// ... agent makes decision ...
const duration = (Date.now() - startTime) / 1000;
recordAgentDecision('technical_analyst', 'buy', duration, 0.85, 'AAPL');

// Update portfolio metrics
updatePortfolioMetrics(
  'strategy-123',
  'user-456',
  105000,  // portfolio value
  2500,    // unrealized P&L
  1500,    // realized P&L
  25000,   // cash balance
  50000    // buying power
);
```

### View Metrics

```bash
# Start your server
pnpm dev

# View metrics in browser or curl
curl http://localhost:3000/metrics

# Or view in Prometheus
# Navigate to http://localhost:9090
# Query: trading_portfolio_value_usd
```

---

## 🔍 Test Market Abuse Surveillance

### Run Surveillance Check

```typescript
import { surveillanceService } from './server/services/compliance/surveillance';

// Run full surveillance
const report = await surveillanceService.runSurveillance(userId, strategyId);

console.log('Surveillance Report:', {
  alerts: report.alerts.length,
  summary: report.summary,
});

// Check specific patterns
const washTradingAlerts = await surveillanceService.detectWashTrading(strategyId);
console.log('Wash Trading Alerts:', washTradingAlerts);

const layeringAlerts = await surveillanceService.detectLayering(strategyId);
console.log('Layering Alerts:', layeringAlerts);
```

### Get Surveillance History

```typescript
const history = await surveillanceService.getSurveillanceHistory(strategyId, 30);
console.log('Surveillance History (last 30 days):', {
  totalAlerts: history.length,
  highSeverity: history.filter(a => a.severity === 'high').length,
});
```

---

## 🎯 Integration Example

Here's a complete example integrating multiple features:

```typescript
import { BacktestEngine } from './server/services/backtesting/backtestEngine';
import { pdtTracker } from './server/services/compliance/pdtTracker';
import { surveillanceService } from './server/services/compliance/surveillance';
import { cache } from './server/services/cache';
import { recordOrderPlaced, updatePortfolioMetrics } from './server/services/monitoring/prometheus';

async function runComprehensiveTest(userId: string, strategyId: string) {
  console.log('=== Comprehensive Feature Test ===\n');

  // 1. Check cache health
  console.log('1. Checking cache...');
  const cacheStats = await cache.getStats();
  console.log('   Cache:', cacheStats.enabled ? '✓ Connected' : '✗ Disabled');

  // 2. Run backtest
  console.log('\n2. Running backtest...');
  const backtestConfig = {
    strategyId,
    symbols: ['AAPL', 'MSFT'],
    startDate: new Date('2024-10-01'),
    endDate: new Date('2024-10-19'),
    initialCapital: 100000,
    commission: 1.0,
  };

  const engine = new BacktestEngine(backtestConfig);
  const results = await engine.runBacktest();
  console.log('   Return:', (results.totalReturn * 100).toFixed(2) + '%');
  console.log('   Sharpe:', results.sharpeRatio.toFixed(2));
  console.log('   Win Rate:', (results.winRate * 100).toFixed(2) + '%');

  // 3. Check PDT status
  console.log('\n3. Checking PDT compliance...');
  const pdtStatus = await pdtTracker.checkPDTStatus(userId, strategyId);
  console.log('   Day Trades:', pdtStatus.dayTradesLast5Days + '/4');
  console.log('   Can Day Trade:', pdtStatus.canDayTrade ? 'Yes' : 'No');
  if (pdtStatus.warning) {
    console.log('   ⚠️', pdtStatus.warning);
  }

  // 4. Run surveillance
  console.log('\n4. Running market abuse surveillance...');
  const surveillance = await surveillanceService.runSurveillance(userId, strategyId);
  console.log('   Alerts:', surveillance.summary.total);
  console.log('   High Severity:', surveillance.summary.high);

  // 5. Record metrics
  console.log('\n5. Recording metrics...');
  recordOrderPlaced('AAPL', 'buy', strategyId);
  updatePortfolioMetrics(strategyId, userId, 105000, 2500, 1500, 25000, 50000);
  console.log('   ✓ Metrics recorded');

  console.log('\n=== Test Complete ===');
}

// Run the test
runComprehensiveTest('user-123', 'strategy-456').catch(console.error);
```

---

## 📋 Verification Checklist

After running the tests, verify:

- [ ] Backtest completes successfully with results
- [ ] PDT tracking identifies day trades correctly
- [ ] Redis caching works (or gracefully falls back if disabled)
- [ ] Prometheus metrics are exposed at `/metrics`
- [ ] Surveillance detects no alerts (for normal trading)
- [ ] Database tables created (backtests, backtestTrades, backtestEquityCurve)
- [ ] Audit logs contain PDT and surveillance events

---

## 🐛 Troubleshooting

### Backtest Issues

**Problem**: No historical data loaded  
**Solution**: Check market data API connectivity and date range

**Problem**: No trades executed  
**Solution**: Adjust strategy logic or use different symbols

### Redis Issues

**Problem**: Cache not working  
**Solution**: Check REDIS_URL environment variable, or run without Redis (graceful fallback)

**Problem**: Connection refused  
**Solution**: Ensure Redis is running: `docker ps` or `redis-cli ping`

### Prometheus Issues

**Problem**: Metrics endpoint returns empty  
**Solution**: Ensure you've recorded some metrics first

**Problem**: Grafana can't connect  
**Solution**: Check Prometheus data source URL in Grafana settings

### PDT Issues

**Problem**: Not detecting day trades  
**Solution**: Ensure orders are in 'filled' status and created on same day

---

## 📚 Additional Resources

- [Backtesting Documentation](./ROADMAP_IMPLEMENTATION_STATUS.md#11-backtesting-framework)
- [PDT Tracker API](./server/services/compliance/pdtTracker.ts)
- [Redis Cache API](./server/services/cache.ts)
- [Prometheus Metrics](./server/services/monitoring/prometheus.ts)
- [Surveillance System](./server/services/compliance/surveillance.ts)
- [Grafana Dashboard](./server/services/monitoring/grafana-dashboard.json)

---

## 🎉 Success!

If all tests pass, you're ready to:
1. Run backtests on your strategies
2. Trade with PDT compliance
3. Monitor with Prometheus + Grafana
4. Detect market abuse patterns
5. Scale with Redis caching

**Next Steps**: See [ROADMAP_IMPLEMENTATION_STATUS.md](./ROADMAP_IMPLEMENTATION_STATUS.md) for remaining tasks and Phase 3 features.
