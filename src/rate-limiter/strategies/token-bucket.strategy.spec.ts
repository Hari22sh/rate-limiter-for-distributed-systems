import { TokenBucketStrategy } from './token-bucket.strategy';
import { RedisService } from '../../redis/redis.service';

describe('TokenBucketStrategy', () => {
  let strategy: TokenBucketStrategy;
  let mockRedisService: jest.Mocked<Partial<RedisService>>;

  beforeEach(() => {
    mockRedisService = {
      evalScript: jest.fn(),
    };
    strategy = new TokenBucketStrategy(mockRedisService as unknown as RedisService);
  });

  it('should return allowed: true when Redis Lua script returns [1, 4, 0]', async () => {
    (mockRedisService.evalScript as jest.Mock).mockResolvedValue([1, 4, 0]);

    const result = await strategy.check({
      key: 'rate-limit:t1:u1:/api/test',
      limit: 5,
      windowSeconds: 1,
      burst: 5,
    });

    expect(result).toEqual({
      allowed: true,
      remaining: 4,
      retryAfter: 0,
    });

    expect(mockRedisService.evalScript).toHaveBeenCalledWith(
      expect.any(String),
      ['rate-limit:t1:u1:/api/test'],
      [5, 5, expect.any(Number), 60],
    );
  });

  it('should return allowed: false with retryAfter when Lua script returns [0, 0, 1]', async () => {
    (mockRedisService.evalScript as jest.Mock).mockResolvedValue([0, 0, 1]);

    const result = await strategy.check({
      key: 'rate-limit:t1:u1:/api/test',
      limit: 5,
      windowSeconds: 1,
      burst: 5,
    });

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      retryAfter: 1,
    });
  });
});
