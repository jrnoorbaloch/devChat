#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { RateLimiter } from './rate-limiter.ts'

test('RateLimiter allows `limit` hits per window and then blocks', () => {
  let now = 1000
  const limiter = new RateLimiter({ intervalMs: 1000, limit: 2, now: () => now })

  assert.equal(limiter.tryAcquire('a'), true)
  assert.equal(limiter.tryAcquire('a'), true)
  assert.equal(limiter.tryAcquire('a'), false, 'third hit in window should be blocked')
  assert.equal(limiter.tryAcquire('b'), true, 'keys should be independent')
  assert.equal(limiter.remaining('a'), 0)

  now += 1001
  assert.equal(limiter.remaining('a'), 2, 'window should expire')
  assert.equal(limiter.tryAcquire('a'), true)
})

test('RateLimiter does not record rejected hits', () => {
  let now = 0
  const limiter = new RateLimiter({ intervalMs: 100, limit: 1, now: () => now })
  assert.equal(limiter.tryAcquire('x'), true)
  now = 50
  assert.equal(limiter.tryAcquire('x'), false)
  now = 101
  assert.equal(limiter.tryAcquire('x'), true, 'spam during the window must not extend the lockout')
})

test('RateLimiter.reset() clears one key or all keys', () => {
  const limiter = new RateLimiter({ intervalMs: 10_000, limit: 1 })
  limiter.tryAcquire('a')
  limiter.tryAcquire('b')
  limiter.reset('a')
  assert.equal(limiter.tryAcquire('a'), true)
  assert.equal(limiter.tryAcquire('b'), false)
  limiter.reset()
  assert.equal(limiter.tryAcquire('b'), true)
})

test('RateLimiter validates options', () => {
  assert.throws(() => new RateLimiter({ intervalMs: 1, limit: 0 }), RangeError)
  assert.throws(() => new RateLimiter({ intervalMs: 1, limit: 1.5 }), RangeError)
  assert.throws(() => new RateLimiter({ intervalMs: 0, limit: 1 }), RangeError)
})
