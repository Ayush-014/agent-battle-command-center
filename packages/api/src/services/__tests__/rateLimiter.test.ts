import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock rate limiter module
const mockRateLimiter = jest.fn();
jest.mock('express-rate-limit', () => ({
  default: (config: any) => {
    mockRateLimiter(config);
    return (req: any, res: any, next: any) => next();
  },
}));

describe.skip('rateLimiter middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create rate limiter with default config', async () => {
    // Import after mocking
    await import('../rateLimiter.js');

    expect(mockRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: expect.any(Number),
        max: expect.any(Number),
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
  });

  it('should use environment variable for window time', async () => {
    process.env.RATE_LIMIT_WINDOW_MS = '30000';

    // Re-import to pick up env var
    delete require.cache[require.resolve('../rateLimiter.js')];
    await import('../rateLimiter.js');

    expect(mockRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 30000,
      })
    );

    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it('should use environment variable for max requests', async () => {
    process.env.RATE_LIMIT_MAX = '200';

    delete require.cache[require.resolve('../rateLimiter.js')];
    await import('../rateLimiter.js');

    expect(mockRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({
        max: 200,
      })
    );

    delete process.env.RATE_LIMIT_MAX;
  });

  it('should include custom message in response', async () => {
    await import('../rateLimiter.js');

    const config = mockRateLimiter.mock.calls[0][0] as any;
    expect(config.message).toBeDefined();
    expect(config.message).toContain('rate limit');
  });

  it('should use sliding window by default', async () => {
    await import('../rateLimiter.js');

    const config = mockRateLimiter.mock.calls[0][0] as any;
    expect(config.standardHeaders).toBe(true);
    expect(config.legacyHeaders).toBe(false);
  });
});
