/**
 * Broker Factory
 * Creates the appropriate broker based on TRADING_MODE environment variable
 */

import { IBroker, BrokerMode } from './types';
import { AlpacaBroker } from './alpacaBroker';

let brokerInstance: IBroker | null = null;

export function getBroker(): IBroker {
  if (brokerInstance) {
    return brokerInstance;
  }

  const mode = (process.env.TRADING_MODE || 'paper') as BrokerMode;
  
  console.log(`[Broker] Initializing broker in ${mode} mode`);
  
  brokerInstance = new AlpacaBroker(mode);
  
  return brokerInstance;
}

// Re-export types for convenience
export * from './types';
