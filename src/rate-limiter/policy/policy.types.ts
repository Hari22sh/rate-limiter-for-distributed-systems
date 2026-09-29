export enum RateLimitAlgorithm {
  FIXED_WINDOW = 'FIXED_WINDOW',
  SLIDING_WINDOW_COUNTER = 'SLIDING_WINDOW_COUNTER',
  SLIDING_WINDOW_LOG = 'SLIDING_WINDOW_LOG',
  TOKEN_BUCKET = 'TOKEN_BUCKET',
  LEAKY_BUCKET = 'LEAKY_BUCKET',
  GCRA = 'GCRA',
}

export interface RateLimitPolicy {
  route: string;
  algorithm: RateLimitAlgorithm;
  limit: number;
  windowSeconds: number;
  burst?: number;
  keyStrategy?: string;
}

export interface RateLimitContext {
  key: string;
  limit: number;
  windowSeconds: number;
  burst?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // in seconds
}

export interface RequestContext {
  tenantId: string;
  userId: string;
  route: string;
  ip: string;
}
