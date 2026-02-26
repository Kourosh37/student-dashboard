type LimitConfig = {
  windowMs: number;
  maxRequests: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const bucketStore = new Map<string, Bucket>();

export function checkRateLimit(key: string, config: LimitConfig) {
  const now = Date.now();
  const bucket = bucketStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucketStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      retryAfter: 0,
    };
  }

  if (bucket.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  bucketStore.set(key, bucket);

  return {
    allowed: true,
    remaining: config.maxRequests - bucket.count,
    retryAfter: 0,
  };
}

