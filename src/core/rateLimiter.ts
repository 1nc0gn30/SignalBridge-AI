import type { RateLimitConfig, RateLimitResult } from './types.ts';

/**
 * Per-sender sliding-window rate limiter with bounded memory cleanup.
 */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private maxRequests: number;
  private windowMs: number;

  constructor(config: RateLimitConfig) {
    this.maxRequests = Math.max(1, Math.floor(config.maxRequests));
    this.windowMs = Math.max(1000, Math.floor(config.windowMs));
  }

  updateConfig(config: RateLimitConfig): void {
    this.maxRequests = Math.max(1, Math.floor(config.maxRequests));
    this.windowMs = Math.max(1000, Math.floor(config.windowMs));
  }

  check(key: string, now = Date.now()): RateLimitResult {
    const cutoff = now - this.windowMs;
    const existing = this.buckets.get(key) ?? [];
    const active = existing.filter((ts) => ts > cutoff);

    if (active.length >= this.maxRequests) {
      const oldest = active[0];
      const resetAt = oldest + this.windowMs;
      const retryAfterMs = Math.max(0, resetAt - now);
      this.buckets.set(key, active);
      return {
        allowed: false,
        remaining: 0,
        limit: this.maxRequests,
        resetAt,
        retryAfterMs,
      };
    }

    active.push(now);
    this.buckets.set(key, active);
    this.pruneIfNeeded(now);

    const oldest = active[0] ?? now;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - active.length),
      limit: this.maxRequests,
      resetAt: oldest + this.windowMs,
      retryAfterMs: 0,
    };
  }

  snapshot(key: string, now = Date.now()): RateLimitResult {
    const cutoff = now - this.windowMs;
    const active = (this.buckets.get(key) ?? []).filter((ts) => ts > cutoff);
    const remaining = Math.max(0, this.maxRequests - active.length);
    const oldest = active[0] ?? now;
    const resetAt = oldest + this.windowMs;
    return {
      allowed: remaining > 0,
      remaining,
      limit: this.maxRequests,
      resetAt,
      retryAfterMs: remaining > 0 ? 0 : Math.max(0, resetAt - now),
    };
  }

  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  private pruneIfNeeded(now: number): void {
    if (this.buckets.size < 256) return;
    const cutoff = now - this.windowMs;
    for (const [k, timestamps] of this.buckets.entries()) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        this.buckets.delete(k);
      } else {
        this.buckets.set(k, fresh);
      }
    }
  }
}
