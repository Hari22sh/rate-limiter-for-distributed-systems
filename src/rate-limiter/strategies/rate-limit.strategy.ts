import { RateLimitContext, RateLimitResult } from '../policy/policy.types';

export interface RateLimitStrategy {
  check(context: RateLimitContext): Promise<RateLimitResult>;
}
