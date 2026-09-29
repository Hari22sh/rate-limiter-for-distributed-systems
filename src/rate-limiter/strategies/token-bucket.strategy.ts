import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { RateLimitContext, RateLimitResult } from '../policy/policy.types';
import { RateLimitStrategy } from './rate-limit.strategy';

@Injectable()
export class TokenBucketStrategy implements RateLimitStrategy {
  private readonly logger = new Logger(TokenBucketStrategy.name);

  /**
   * Atomic Lua script for Token Bucket algorithm.
   *
   * KEYS[1]: rate limit key
   * ARGV[1]: capacity (burst limit)
   * ARGV[2]: refill rate (tokens per second)
   * ARGV[3]: current timestamp in milliseconds
   * ARGV[4]: TTL for the Redis key in seconds
   *
   * Returns array: [allowed (1 or 0), remaining_tokens, retry_after_seconds]
   */
  private readonly luaScript = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local ttl = tonumber(ARGV[4])

    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(data[1])
    local last_refill = tonumber(data[2])

    if tokens == nil or last_refill == nil then
      tokens = capacity - 1
      last_refill = now
      redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
      redis.call('EXPIRE', key, ttl)
      return {1, math.floor(tokens), 0}
    else
      local elapsed_seconds = (now - last_refill) / 1000.0
      if elapsed_seconds > 0 then
        local refilled = elapsed_seconds * refill_rate
        tokens = math.min(capacity, tokens + refilled)
        last_refill = now
      end

      if tokens >= 1 then
        tokens = tokens - 1
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
        redis.call('EXPIRE', key, ttl)
        return {1, math.floor(tokens), 0}
      else
        local needed = 1.0 - tokens
        local retry_after = math.ceil(needed / refill_rate)
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
        redis.call('EXPIRE', key, ttl)
        return {0, 0, retry_after}
      end
    end
  `;

  constructor(private readonly redisService: RedisService) {}

  async check(context: RateLimitContext): Promise<RateLimitResult> {
    const capacity = context.burst ?? context.limit;
    const refillRate = context.limit / context.windowSeconds; // tokens per second
    const now = Date.now();
    // Keep Redis key alive for 2x the window seconds (or minimum 60 seconds)
    const ttlSeconds = Math.max(Math.ceil(context.windowSeconds * 2), 60);

    try {
      const res = await this.redisService.evalScript(
        this.luaScript,
        [context.key],
        [capacity, refillRate, now, ttlSeconds],
      );

      const [allowedRaw, remainingRaw, retryAfterRaw] = res as [number, number, number];

      return {
        allowed: allowedRaw === 1,
        remaining: Math.max(0, remainingRaw),
        retryAfter: retryAfterRaw,
      };
    } catch (err: any) {
      this.logger.error(`Error executing Token Bucket Lua script for key ${context.key}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
