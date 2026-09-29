import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimiterService } from './rate-limiter.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let mockRateLimiterService: jest.Mocked<Partial<RateLimiterService>>;

  const createMockContext = (
    headers: Record<string, string> = {},
    ip: string = '127.0.0.1',
    routePath: string = '/api/test',
  ): ExecutionContext => {
    const mockRequest: any = {
      headers,
      ip,
      route: { path: routePath },
    };

    const mockResponse: any = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockRateLimiterService = {
      checkRateLimit: jest.fn(),
    };
    guard = new RateLimitGuard(mockRateLimiterService as unknown as RateLimiterService);
  });

  it('should allow request and set rate limit response headers when allowed', async () => {
    (mockRateLimiterService.checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfter: 0,
      limit: 5,
    });

    const mockContext = createMockContext({
      'x-tenant-id': 'tenant-a',
      'x-user-id': 'user-b',
    });

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);

    const res = mockContext.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
  });

  it('should throw 429 HttpException and set Retry-After header when rate limit is exceeded', async () => {
    (mockRateLimiterService.checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfter: 2,
      limit: 5,
    });

    const mockContext = createMockContext();

    await expect(guard.canActivate(mockContext)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(mockContext);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }

    const res = mockContext.switchToHttp().getResponse();
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '2');
  });
});
