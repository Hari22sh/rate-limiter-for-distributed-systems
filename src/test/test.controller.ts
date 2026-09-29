import { Controller, Get, UseGuards } from '@nestjs/common';
import { RateLimitGuard } from '../rate-limiter/rate-limit.guard';

@Controller('api/test')
export class TestController {
  @Get()
  @UseGuards(RateLimitGuard)
  getTest() {
    return { message: 'Request accepted' };
  }
}
