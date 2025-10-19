/**
 * Broker Factory - Creates appropriate broker based on mode
 * Mode is controlled by TRADING_MODE environment variable
 */

import { IBroker, BrokerMode } from './types';
import { MockBroker } from './mockBroker';
import { AlpacaBroker } from './alpacaBroker';

export * from './types';
export { MockBroker } from './mockBroker';
export { AlpacaBroker } from './alpacaBroker';

/**
 * Create broker instance based on environment configuration
 * TRADING_MODE: 'mock' | 'paper' | 'live'
 * Default: 'mock'
 */
export function createBroker(): IBroker {
  const mode = (process.env.TRADING_MODE || 'mock') as BrokerMode;
  
  console.log(`[Broker] Creating broker in ${mode} mode`);
  
  switch (mode) {
    case 'mock':
      return new MockBroker(parseFloat(process.env.INITIAL_CAPITAL || '100000'));
    
    case 'paper':
    case 'live':
      // Both paper and live use Alpaca, but paper=true for paper trading
      if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
        console.warn(`[Broker] Alpaca credentials not found, falling back to mock mode`);
        return new MockBroker(parseFloat(process.env.INITIAL_CAPITAL || '100000'));
      }
      return new AlpacaBroker(mode);
    
    default:
      console.warn(`[Broker] Unknown mode ${mode}, using mock`);
      return new MockBroker(parseFloat(process.env.INITIAL_CAPITAL || '100000'));
  }
}

/**
 * Singleton broker instance
 */
let brokerInstance: IBroker | null = null;

export function getBroker(): IBroker {
  if (!brokerInstance) {
    brokerInstance = createBroker();
  }
  return brokerInstance;
}

/**
 * Reset broker instance (useful for testing)
 */
export function resetBroker(): void {
  brokerInstance = null;
}

