import { PolicyEngine } from './policy.engine';
import { RateLimitAlgorithm } from './policy.types';

describe('PolicyEngine', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine();
  });

  it('should return configured policy for registered route', () => {
    const policy = policyEngine.getPolicyForRoute('/api/test');
    expect(policy).toBeDefined();
    expect(policy.route).toBe('/api/test');
    expect(policy.algorithm).toBe(RateLimitAlgorithm.TOKEN_BUCKET);
    expect(policy.limit).toBe(5);
    expect(policy.windowSeconds).toBe(1);
    expect(policy.burst).toBe(5);
  });

  it('should return default fallback policy for unregistered route', () => {
    const policy = policyEngine.getPolicyForRoute('/api/unknown');
    expect(policy).toBeDefined();
    expect(policy.route).toBe('/api/unknown');
    expect(policy.limit).toBe(10);
  });

  it('should generate properly formatted rate limit keys', () => {
    const key = policyEngine.generateKey({
      tenantId: 'tenant-123',
      userId: 'user-456',
      route: '/api/test',
      ip: '127.0.0.1',
    });
    expect(key).toBe('rate-limit:tenant-123:user-456:/api/test');
  });

  it('should sanitize colons in context identifiers', () => {
    const key = policyEngine.generateKey({
      tenantId: 'tenant:1',
      userId: 'user:2',
      route: '/api/test:v1',
      ip: '127.0.0.1',
    });
    expect(key).toBe('rate-limit:tenant_1:user_2:/api/test_v1');
  });
});
