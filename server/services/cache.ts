// Redis caching layer for market data, indicators, and agent decisions
// Provides sub-millisecond access and reduces API calls

import Redis from 'ioredis';
import { TechnicalIndicators } from './marketData/types';

export class CacheService {
  private redis: Redis;
  private enabled: boolean;

  constructor() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
    
    if (!redisUrl) {
      console.warn('[Cache] Redis URL not configured. Caching disabled. Set REDIS_URL or REDIS_CONNECTION_STRING environment variable.');
      this.enabled = false;
      // Create a mock redis client for development
      this.redis = {
        get: async () => null,
        setex: async () => 'OK',
        del: async () => 1,
        incr: async () => 1,
        expire: async () => 1,
      } as any;
    } else {
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('[Cache] Redis connection failed after 3 retries. Disabling cache.');
            this.enabled = false;
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });
      this.enabled = true;
      
      this.redis.on('connect', () => {
        console.log('[Cache] Redis connected');
      });
      
      this.redis.on('error', (err) => {
        console.error('[Cache] Redis error:', err);
        this.enabled = false;
      });
    }
  }

  /**
   * Cache current price for a symbol
   */
  async cachePrice(symbol: string, price: number, ttl: number = 60): Promise<void> {
    if (!this.enabled) return;
    
    try {
      await this.redis.setex(`price:${symbol}`, ttl, price.toString());
    } catch (error) {
      console.error(`[Cache] Failed to cache price for ${symbol}:`, error);
    }
  }

  /**
   * Get cached price
   */
  async getCachedPrice(symbol: string): Promise<number | null> {
    if (!this.enabled) return null;
    
    try {
      const cached = await this.redis.get(`price:${symbol}`);
      return cached ? parseFloat(cached) : null;
    } catch (error) {
      console.error(`[Cache] Failed to get cached price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Cache technical indicators
   */
  async cacheIndicators(
    symbol: string,
    indicators: TechnicalIndicators,
    ttl: number = 300
  ): Promise<void> {
    if (!this.enabled) return;
    
    try {
      await this.redis.setex(`indicators:${symbol}`, ttl, JSON.stringify(indicators));
    } catch (error) {
      console.error(`[Cache] Failed to cache indicators for ${symbol}:`, error);
    }
  }

  /**
   * Get cached technical indicators
   */
  async getCachedIndicators(symbol: string): Promise<TechnicalIndicators | null> {
    if (!this.enabled) return null;
    
    try {
      const cached = await this.redis.get(`indicators:${symbol}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`[Cache] Failed to get cached indicators for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Cache agent decision (prevents repeated LLM calls for same input)
   */
  async cacheAgentDecision(
    agentType: string,
    symbol: string,
    context: any,
    decision: any,
    ttl: number = 60
  ): Promise<void> {
    if (!this.enabled) return;
    
    try {
      const contextHash = this.hashContext(context);
      const key = `agent:${agentType}:${symbol}:${contextHash}`;
      await this.redis.setex(key, ttl, JSON.stringify(decision));
    } catch (error) {
      console.error(`[Cache] Failed to cache agent decision:`, error);
    }
  }

  /**
   * Get cached agent decision
   */
  async getCachedAgentDecision(
    agentType: string,
    symbol: string,
    context: any
  ): Promise<any | null> {
    if (!this.enabled) return null;
    
    try {
      const contextHash = this.hashContext(context);
      const key = `agent:${agentType}:${symbol}:${contextHash}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`[Cache] Failed to get cached agent decision:`, error);
      return null;
    }
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    if (!this.enabled) {
      return { allowed: true, remaining: limit, resetIn: 0 };
    }
    
    try {
      const rateLimitKey = `ratelimit:${key}`;
      const current = await this.redis.incr(rateLimitKey);
      
      if (current === 1) {
        await this.redis.expire(rateLimitKey, windowSeconds);
      }
      
      const ttl = await this.redis.ttl(rateLimitKey);
      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;
      
      return {
        allowed,
        remaining,
        resetIn: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (error) {
      console.error(`[Cache] Rate limit check failed:`, error);
      return { allowed: true, remaining: limit, resetIn: 0 };
    }
  }

  /**
   * Cache market data (OHLCV)
   */
  async cacheMarketData(
    symbol: string,
    interval: string,
    data: any,
    ttl: number = 300
  ): Promise<void> {
    if (!this.enabled) return;
    
    try {
      const key = `marketdata:${symbol}:${interval}`;
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error(`[Cache] Failed to cache market data:`, error);
    }
  }

  /**
   * Get cached market data
   */
  async getCachedMarketData(symbol: string, interval: string): Promise<any | null> {
    if (!this.enabled) return null;
    
    try {
      const key = `marketdata:${symbol}:${interval}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`[Cache] Failed to get cached market data:`, error);
      return null;
    }
  }

  /**
   * Invalidate cache for a symbol
   */
  async invalidateSymbol(symbol: string): Promise<void> {
    if (!this.enabled) return;
    
    try {
      const keys = await this.redis.keys(`*:${symbol}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`[Cache] Failed to invalidate cache for ${symbol}:`, error);
    }
  }

  /**
   * Cache portfolio metrics
   */
  async cachePortfolioMetrics(
    strategyId: string,
    metrics: any,
    ttl: number = 60
  ): Promise<void> {
    if (!this.enabled) return;
    
    try {
      const key = `portfolio:${strategyId}:metrics`;
      await this.redis.setex(key, ttl, JSON.stringify(metrics));
    } catch (error) {
      console.error(`[Cache] Failed to cache portfolio metrics:`, error);
    }
  }

  /**
   * Get cached portfolio metrics
   */
  async getCachedPortfolioMetrics(strategyId: string): Promise<any | null> {
    if (!this.enabled) return null;
    
    try {
      const key = `portfolio:${strategyId}:metrics`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`[Cache] Failed to get cached portfolio metrics:`, error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false;
    
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    connected: boolean;
    keyCount: number;
    memory: string;
  }> {
    if (!this.enabled) {
      return {
        enabled: false,
        connected: false,
        keyCount: 0,
        memory: '0B',
      };
    }
    
    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();
      
      // Parse memory usage from info string
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      
      return {
        enabled: true,
        connected: this.redis.status === 'ready',
        keyCount: dbSize,
        memory,
      };
    } catch (error) {
      return {
        enabled: true,
        connected: false,
        keyCount: 0,
        memory: 'error',
      };
    }
  }

  /**
   * Hash context for cache key generation
   */
  private hashContext(context: any): string {
    // Simple hash of context object
    const str = JSON.stringify(context);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.enabled) {
      await this.redis.quit();
    }
  }
}

// Export singleton instance
export const cache = new CacheService();

// Export type for dependency injection
export type { CacheService };
