// Realistic slippage and order fill simulation

export interface SlippageConfig {
  baseSlippagePercent: number; // e.g., 0.001 for 0.1%
  volumeImpactFactor: number; // how much volume affects slippage
  marketImpactFactor: number; // market conditions impact
}

export const DEFAULT_SLIPPAGE_CONFIG: SlippageConfig = {
  baseSlippagePercent: 0.001, // 0.1%
  volumeImpactFactor: 0.0005,
  marketImpactFactor: 0.0002,
};

export function calculateRealisticFillPrice(
  orderSide: 'buy' | 'sell',
  marketPrice: number,
  quantity: number,
  averageVolume: number,
  volatility: number,
  config: SlippageConfig = DEFAULT_SLIPPAGE_CONFIG
): number {
  // Base slippage
  let slippagePercent = config.baseSlippagePercent;
  
  // Volume impact: larger orders relative to volume get worse fills
  const volumeRatio = quantity / (averageVolume / 100); // Normalized to 1% of daily volume
  slippagePercent += volumeRatio * config.volumeImpactFactor;
  
  // Market impact: higher volatility means worse fills
  slippagePercent += volatility * config.marketImpactFactor;
  
  // Cap slippage at 2%
  slippagePercent = Math.min(slippagePercent, 0.02);
  
  const slippageAmount = marketPrice * slippagePercent;
  
  // Buy orders get worse fills (higher price), sell orders get worse fills (lower price)
  if (orderSide === 'buy') {
    return marketPrice + slippageAmount;
  } else {
    return marketPrice - slippageAmount;
  }
}

export function shouldFillOrder(
  orderSide: 'buy' | 'sell',
  limitPrice: number | undefined,
  marketPrice: number
): boolean {
  // Market orders always fill
  if (!limitPrice) return true;
  
  // Limit buy: only fill if market price is at or below limit
  if (orderSide === 'buy') {
    return marketPrice <= limitPrice;
  }
  
  // Limit sell: only fill if market price is at or above limit
  return marketPrice >= limitPrice;
}

export function calculateCommission(
  quantity: number,
  price: number,
  commissionPerTrade: number,
  commissionPerShare: number = 0
): number {
  return commissionPerTrade + (quantity * commissionPerShare);
}

export interface FillSimulationResult {
  filled: boolean;
  fillPrice: number;
  fillQuantity: number;
  commission: number;
  slippage: number;
}

export function simulateOrderFill(
  orderSide: 'buy' | 'sell',
  orderType: 'market' | 'limit',
  quantity: number,
  limitPrice: number | undefined,
  marketPrice: number,
  averageVolume: number,
  volatility: number,
  commissionPerTrade: number,
  slippageConfig: SlippageConfig = DEFAULT_SLIPPAGE_CONFIG
): FillSimulationResult {
  // Check if order should fill
  const shouldFill = orderType === 'market' || shouldFillOrder(orderSide, limitPrice, marketPrice);
  
  if (!shouldFill) {
    return {
      filled: false,
      fillPrice: 0,
      fillQuantity: 0,
      commission: 0,
      slippage: 0,
    };
  }
  
  // Calculate realistic fill price with slippage
  const fillPrice = calculateRealisticFillPrice(
    orderSide,
    marketPrice,
    quantity,
    averageVolume,
    volatility,
    slippageConfig
  );
  
  // Calculate commission
  const commission = calculateCommission(quantity, fillPrice, commissionPerTrade);
  
  // Calculate slippage amount
  const slippage = Math.abs(fillPrice - marketPrice) * quantity;
  
  return {
    filled: true,
    fillPrice,
    fillQuantity: quantity,
    commission,
    slippage,
  };
}

// Partial fill simulation for large orders
export function simulatePartialFill(
  orderSide: 'buy' | 'sell',
  requestedQuantity: number,
  marketPrice: number,
  availableLiquidity: number
): { fillQuantity: number; avgFillPrice: number } {
  // If order is larger than available liquidity, only partially fill
  const fillQuantity = Math.min(requestedQuantity, availableLiquidity);
  
  // Calculate price impact for partial fill
  const impactPercent = (fillQuantity / availableLiquidity) * 0.005; // 0.5% max impact
  const priceImpact = marketPrice * impactPercent;
  
  const avgFillPrice = orderSide === 'buy' 
    ? marketPrice + priceImpact / 2 // Average price during accumulation
    : marketPrice - priceImpact / 2;
  
  return { fillQuantity, avgFillPrice };
}
