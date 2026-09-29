import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from './rate-limiter.service';
import { PolicyEngine } from './policy/policy.engine';
import { StrategyFactory } from './strategy.factory';
import { RateLimitStrategy } from './strategies/rate-limit.strategy';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let mockStrategy: jest.Mocked<RateLimitStrategy>;

  beforeEach(async () => {
    mockStrategy = {
      check: jest.fn(),
    };

    const mockStrategyFactory = {
      getStrategy: jest.fn().mockReturnValue(mockStrategy),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        PolicyEngine,
        { provide: StrategyFactory, useValue: mockStrategyFactory },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('FAIL_OPEN') },
        },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
  });

  it('should delegate check to appropriate strategy', async () => {
    mockStrategy.check.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfter: 0,
    });

    const result = await service.checkRateLimit({
      tenantId: 'tenant1',
      userId: 'user1',
      route: '/api/test',
      ip: '127.0.0.1',
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('should fail open if strategy throws an error under FAIL_OPEN mode', async () => {
    mockStrategy.check.mockRejectedValue(new Error('Redis connection lost'));

    const result = await service.checkRateLimit({
      tenantId: 'tenant1',
      userId: 'user1',
      route: '/api/test',
      ip: '127.0.0.1',
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });
});
