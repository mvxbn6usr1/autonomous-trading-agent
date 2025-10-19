// Test script for backtesting framework

import { BacktestEngine } from './server/services/backtesting/backtestEngine';
import { BacktestConfig } from './server/services/backtesting/types';

async function runBacktestTest() {
  console.log('=== Backtesting Framework Test ===\n');

  // Configure backtest
  const config: BacktestConfig = {
    strategyId: 'test-strategy-1',
    symbols: ['AAPL', 'MSFT', 'GOOGL'],
    startDate: new Date('2024-10-01'),
    endDate: new Date('2024-10-19'),
    initialCapital: 100000,
    commission: 1.0, // $1 per trade
  };

  console.log('Configuration:', {
    symbols: config.symbols,
    period: `${config.startDate.toISOString().split('T')[0]} to ${config.endDate.toISOString().split('T')[0]}`,
    initialCapital: `$${config.initialCapital.toLocaleString()}`,
    commission: `$${config.commission} per trade`,
  });
  console.log('');

  // Create backtest engine with progress callback
  const engine = new BacktestEngine(config, undefined, (progress) => {
    if (progress.progress % 25 === 0 || progress.progress === 100) {
      console.log(
        `Progress: ${progress.progress.toFixed(0)}% | ` +
        `Date: ${progress.currentDate.toISOString().split('T')[0]} | ` +
        `Trades: ${progress.tradesExecuted} | ` +
        `Equity: $${progress.currentEquity.toFixed(2)}`
      );
    }
  });

  try {
    // Run backtest
    console.log('Starting backtest...\n');
    const startTime = Date.now();
    
    const results = await engine.runBacktest();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n=== Backtest Results ===\n');
    console.log(`Execution Time: ${duration}s`);
    console.log('');
    
    // Performance metrics
    console.log('Performance Metrics:');
    console.log(`  Total Return: ${(results.totalReturn * 100).toFixed(2)}%`);
    console.log(`  Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown: ${(results.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`  Win Rate: ${(results.winRate * 100).toFixed(2)}%`);
    console.log(`  Profit Factor: ${results.profitFactor.toFixed(2)}`);
    console.log(`  Total Trades: ${results.totalTrades}`);
    console.log('');

    // Trade summary
    const winningTrades = results.trades.filter(t => t.pnl > 0);
    const losingTrades = results.trades.filter(t => t.pnl < 0);
    const totalPnL = results.trades.reduce((sum, t) => sum + t.pnl, 0);
    
    console.log('Trade Summary:');
    console.log(`  Winning Trades: ${winningTrades.length}`);
    console.log(`  Losing Trades: ${losingTrades.length}`);
    console.log(`  Average Win: $${(winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length || 0).toFixed(2)}`);
    console.log(`  Average Loss: $${(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length || 0).toFixed(2)}`);
    console.log(`  Total P&L: $${totalPnL.toFixed(2)}`);
    console.log('');

    // Equity curve summary
    const startEquity = results.equityCurve[0]?.value || config.initialCapital;
    const endEquity = results.equityCurve[results.equityCurve.length - 1]?.value || config.initialCapital;
    console.log('Equity Curve:');
    console.log(`  Starting Equity: $${startEquity.toFixed(2)}`);
    console.log(`  Ending Equity: $${endEquity.toFixed(2)}`);
    console.log(`  Peak Equity: $${Math.max(...results.equityCurve.map(p => p.value)).toFixed(2)}`);
    console.log(`  Lowest Equity: $${Math.min(...results.equityCurve.map(p => p.value)).toFixed(2)}`);
    console.log('');

    // Monthly returns
    if (results.monthlyReturns.length > 0) {
      console.log('Monthly Returns:');
      results.monthlyReturns.forEach(mr => {
        console.log(`  ${mr.month}: ${(mr.return * 100).toFixed(2)}%`);
      });
      console.log('');
    }

    // Recent trades
    console.log('Recent Trades (last 5):');
    const recentTrades = results.trades.slice(-5);
    recentTrades.forEach(trade => {
      const pnlStr = trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`;
      console.log(
        `  ${trade.date.toISOString().split('T')[0]} | ` +
        `${trade.action.toUpperCase()} ${trade.quantity} ${trade.symbol} @ $${trade.price.toFixed(2)} | ` +
        `P&L: ${pnlStr}`
      );
    });
    console.log('');

    // Success criteria
    console.log('Success Criteria:');
    console.log(`  ✓ Backtest completed successfully`);
    console.log(`  ${results.sharpeRatio > 1 ? '✓' : '✗'} Sharpe Ratio > 1.0 (${results.sharpeRatio.toFixed(2)})`);
    console.log(`  ${results.totalReturn > 0 ? '✓' : '✗'} Positive Returns (${(results.totalReturn * 100).toFixed(2)}%)`);
    console.log(`  ${results.maxDrawdown < 0.20 ? '✓' : '✗'} Max Drawdown < 20% (${(results.maxDrawdown * 100).toFixed(2)}%)`);
    console.log(`  ${results.winRate > 0.5 ? '✓' : '✗'} Win Rate > 50% (${(results.winRate * 100).toFixed(2)}%)`);
    console.log('');

    console.log('=== Test Complete ===');

  } catch (error) {
    console.error('Backtest failed:', error);
    process.exit(1);
  }
}

// Run the test
runBacktestTest().catch(console.error);
