/**
 * High-performance in-memory sliding window rate limiter
 */
export function createRateLimiter({ windowMs = 5000, maxRequests = 10, message = 'Too many requests. Please slow down.' }) {
  const requests = new Map();

  return function rateLimiter(req, res, next) {
    const key = req.headers['x-session-id'] || req.ip || 'global';
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = requests.get(key) || [];
    const validTimestamps = timestamps.filter(t => t > windowStart);

    if (validTimestamps.length >= maxRequests) {
      const oldest = validTimestamps[0];
      const retryAfterMs = Math.max(0, (oldest + windowMs) - now);
      res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `${message} Retry in ${Math.ceil(retryAfterMs / 1000)}s.`
        }
      });
    }

    validTimestamps.push(now);
    requests.set(key, validTimestamps);

    // Periodic cleanup of stale IPs every 100 requests
    if (requests.size > 1000) {
      for (const [k, times] of requests.entries()) {
        if (times.every(t => t <= windowStart)) {
          requests.delete(k);
        }
      }
    }

    next();
  };
}
