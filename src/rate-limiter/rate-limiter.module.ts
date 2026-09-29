import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PolicyEngine } from './policy/policy.engine';
import { TokenBucketStrategy } from './strategies/token-bucket.strategy';
import { StrategyFactory } from './strategy.factory';
import { RateLimiterService } from './rate-limiter.service';
import { RateLimitGuard } from './rate-limit.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    PolicyEngine,
    TokenBucketStrategy,
    StrategyFactory,
    RateLimiterService,
    RateLimitGuard,
  ],
  exports: [RateLimiterService, RateLimitGuard, PolicyEngine],
})
export class RateLimiterModule {}
