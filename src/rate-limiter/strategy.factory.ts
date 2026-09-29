import { Injectable, NotImplementedException } from '@nestjs/common';
import { RateLimitAlgorithm } from './policy/policy.types';
import { RateLimitStrategy } from './strategies/rate-limit.strategy';
import { TokenBucketStrategy } from './strategies/token-bucket.strategy';

@Injectable()
export class StrategyFactory {
  constructor(private readonly tokenBucketStrategy: TokenBucketStrategy) {}

  getStrategy(algorithm: RateLimitAlgorithm): RateLimitStrategy {
    switch (algorithm) {
      case RateLimitAlgorithm.TOKEN_BUCKET:
        return this.tokenBucketStrategy;
      default:
        throw new NotImplementedException(
          `Rate limit algorithm '${algorithm}' is not implemented yet.`,
        );
    }
  }
}
