import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PolicyEngine } from './policy/policy.engine';
import { RequestContext, RateLimitResult } from './policy/policy.types';
import { StrategyFactory } from './strategy.factory';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly failStrategy: 'FAIL_OPEN' | 'FAIL_CLOSED';

  constructor(
    private readonly policyEngine: PolicyEngine,
    private readonly strategyFactory: StrategyFactory,
    private readonly configService: ConfigService,
  ) {
    this.failStrategy =
      (this.configService.get<string>('RATE_LIMITER_FAIL_STRATEGY') as 'FAIL_OPEN' | 'FAIL_CLOSED') ||
      'FAIL_OPEN';
  }

  async checkRateLimit(requestContext: RequestContext): Promise<RateLimitResult & { limit: number }> {
    const policy = this.policyEngine.getPolicyForRoute(requestContext.route);
    const key = this.policyEngine.generateKey(requestContext);
    const strategy = this.strategyFactory.getStrategy(policy.algorithm);

    try {
      const result = await strategy.check({
        key,
        limit: policy.limit,
        windowSeconds: policy.windowSeconds,
        burst: policy.burst,
      });

      return {
        ...result,
        limit: policy.burst ?? policy.limit,
      };
    } catch (error: any) {
      this.logger.error(
        `Rate limiting failed for key ${key} due to error: ${error.message}. Fallback strategy: ${this.failStrategy}`,
      );

      if (this.failStrategy === 'FAIL_OPEN') {
        // High availability: allow traffic when rate limiter infrastructure fails
        return {
          allowed: true,
          remaining: policy.burst ?? policy.limit,
          retryAfter: 0,
          limit: policy.burst ?? policy.limit,
        };
      } else {
        // High security: block traffic when rate limiter infrastructure fails
        return {
          allowed: false,
          remaining: 0,
          retryAfter: 60,
          limit: policy.burst ?? policy.limit,
        };
      }
    }
  }
}
