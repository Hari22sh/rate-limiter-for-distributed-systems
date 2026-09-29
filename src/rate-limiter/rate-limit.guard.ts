import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiterService: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const tenantId = (req.headers['x-tenant-id'] as string) || 'default-tenant';
    const userId = (req.headers['x-user-id'] as string) || 'default-user';
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    
    // Normalize route path
    const route = req.route?.path || req.path || req.url;

    const result = await this.rateLimiterService.checkRateLimit({
      tenantId,
      userId,
      route,
      ip,
    });

    // Set rate limit headers on response
    res.setHeader('X-RateLimit-Limit', result.limit.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter.toString());
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Retry after ${result.retryAfter} second(s).`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
