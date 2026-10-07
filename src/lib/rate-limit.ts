type Entry = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & {
  tempifyRateLimits?: Map<string, Entry>;
};

const store = globalStore.tempifyRateLimits ?? new Map<string, Entry>();
globalStore.tempifyRateLimits = store;

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: limit - current.count, retryAfter: 0 };
}
