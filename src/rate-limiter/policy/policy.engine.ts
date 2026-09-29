import { Injectable } from '@nestjs/common';
import { RateLimitPolicy, RateLimitAlgorithm, RequestContext } from './policy.types';

@Injectable()
export class PolicyEngine {
  // In-memory policy map initially. This can later be loaded from Redis/Database.
  private readonly policies: Map<string, RateLimitPolicy> = new Map();

  constructor() {
    // Register default policy for /api/test as specified in requirement
    this.registerPolicy({
      route: '/api/test',
      algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      limit: 5,
      windowSeconds: 1,
      burst: 5,
    });
  }

  /**
   * Registers or updates a policy for a specific route.
   */
  registerPolicy(policy: RateLimitPolicy): void {
    this.policies.set(policy.route, policy);
  }

  /**
   * Resolves the policy applicable to a route.
   * If no route-specific policy exists, returns a default fallback policy.
   */
  getPolicyForRoute(route: string): RateLimitPolicy {
    const existing = this.policies.get(route);
    if (existing) {
      return existing;
    }

    // Default fallback policy if none configured
    return {
      route,
      algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      limit: 10,
      windowSeconds: 1,
      burst: 10,
    };
  }

  /**
   * Extensible key generation strategy.
   * Format: rate-limit:{tenantId}:{userId}:{route}
   */
  generateKey(context: RequestContext): string {
    const sanitize = (val: string) => val.replace(/:/g, '_');
    return `rate-limit:${sanitize(context.tenantId)}:${sanitize(context.userId)}:${sanitize(context.route)}`;
  }
}
