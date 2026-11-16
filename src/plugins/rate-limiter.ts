/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Sliding-window rate limiter used by the devChat built-in plugins.
 *
 * Why it exists: chat bots are easy to flood. A single user (or a whole room)
 * can trigger hundreds of replies per minute, which gets the bot account
 * throttled or banned by the IM provider. `CommandRouter` and `AutoReply` use
 * this limiter to cap how often one key (usually the talker id) is answered.
 *
 * Boundaries: pure in-memory, single-process, no timers. It owns nothing but
 * its own map of timestamps and never talks to a bot or puppet, so it is safe
 * to unit test with an injected clock.
 */

/** Options accepted by {@link RateLimiter}. */
export interface RateLimiterOptions {
  /** Maximum number of accepted hits per key inside one window. Must be >= 1. */
  limit: number
  /** Window length in milliseconds. Must be > 0. */
  intervalMs: number
  /**
   * Clock used to timestamp hits. Defaults to `Date.now`; tests inject a fake
   * clock so window expiry can be checked without waiting.
   */
  now?: () => number
}

/**
 * Per-key sliding-window rate limiter.
 *
 * Invariant: for any key, at most `limit` calls to {@link RateLimiter.tryAcquire}
 * return `true` within any `intervalMs` window. Rejected attempts are not
 * recorded, so a user who keeps spamming is not locked out longer than the
 * window.
 */
export class RateLimiter {

  readonly limit: number
  readonly intervalMs: number
  protected readonly now: () => number
  protected readonly hits = new Map<string, number[]>()

  /**
   * @throws RangeError when `limit` is not a positive integer or
   *         `intervalMs` is not a positive number.
   */
  constructor (options: RateLimiterOptions) {
    if (!Number.isInteger(options.limit) || options.limit < 1) {
      throw new RangeError(`RateLimiter: limit must be a positive integer, got ${options.limit}`)
    }
    if (!(options.intervalMs > 0)) {
      throw new RangeError(`RateLimiter: intervalMs must be > 0, got ${options.intervalMs}`)
    }
    this.limit      = options.limit
    this.intervalMs = options.intervalMs
    this.now        = options.now ?? Date.now
  }

  /**
   * Try to record one hit for `key`.
   *
   * @returns `true` when the hit is allowed (and recorded), `false` when the
   *          key already used its quota in the current window.
   */
  tryAcquire (key: string): boolean {
    const now    = this.now()
    const recent = this.prune(key, now)
    if (recent.length >= this.limit) {
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    return true
  }

  /**
   * Number of hits `key` can still make in the current window.
   * Does not record a hit.
   */
  remaining (key: string): number {
    return Math.max(0, this.limit - this.prune(key, this.now()).length)
  }

  /**
   * Forget the history of one key, or of every key when called without an
   * argument. Useful for admin "unblock" commands and for tests.
   */
  reset (key?: string): void {
    if (key === undefined) {
      this.hits.clear()
    } else {
      this.hits.delete(key)
    }
  }

  /**
   * Drop timestamps that fell out of the window and return what is left.
   * Empty keys are removed from the map so memory stays proportional to the
   * number of recently active keys, not to every key ever seen.
   */
  protected prune (key: string, now: number): number[] {
    const list = this.hits.get(key)
    if (!list) {
      return []
    }
    const windowStart = now - this.intervalMs
    const recent = list.filter(t => t > windowStart)
    if (recent.length === 0) {
      this.hits.delete(key)
    } else if (recent.length !== list.length) {
      this.hits.set(key, recent)
    }
    return recent
  }

}
