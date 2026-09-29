import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { RateLimiterModule } from '../rate-limiter/rate-limiter.module';

@Module({
  imports: [RateLimiterModule],
  controllers: [TestController],
})
export class TestModule {}
