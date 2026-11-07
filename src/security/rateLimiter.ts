interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

/**
 * In-memory sliding window rate limiter for authentication endpoints.
 * Tracks failed attempts by key (e.g. `ip:email` or `ip`).
 */
class RateLimiter {
  private attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;

  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000, lockoutMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;

    // Periodic sweep every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  /**
   * Checks whether the given key is currently rate-limited.
   */
  isRateLimited(key: string): { limited: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const record = this.attempts.get(key);
    if (!record) return { limited: false };

    if (record.lockedUntil && record.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { limited: true, retryAfterSeconds };
    }

    // Check if the window expired
    if (now - record.firstAttempt > this.windowMs) {
      this.attempts.delete(key);
      return { limited: false };
    }

    return { limited: false };
  }

  /**
   * Registers a failed attempt for the given key.
   * Locks the key if maxAttempts is reached.
   */
  registerFailure(key: string): { remainingAttempts: number; locked: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    let record = this.attempts.get(key);

    if (!record || now - record.firstAttempt > this.windowMs) {
      record = {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      };
      this.attempts.set(key, record);
      return { remainingAttempts: this.maxAttempts - 1, locked: false };
    }

    record.count += 1;
    record.lastAttempt = now;

    if (record.count >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutMs;
      const retryAfterSeconds = Math.ceil(this.lockoutMs / 1000);
      return { remainingAttempts: 0, locked: true, retryAfterSeconds };
    }

    return { remainingAttempts: Math.max(0, this.maxAttempts - record.count), locked: false };
  }

  /**
   * Resets failed attempts upon successful authentication.
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (record.lockedUntil && record.lockedUntil < now) {
        this.attempts.delete(key);
      } else if (now - record.firstAttempt > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}

export const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000, 15 * 60 * 1000);
export const registerRateLimiter = new RateLimiter(10, 60 * 60 * 1000, 30 * 60 * 1000);
