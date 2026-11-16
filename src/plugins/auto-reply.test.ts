#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import {
  AutoReply,
  createAutoReplyHandler,
}                           from './auto-reply.ts'
import { fakeMessage }      from './fake-message.test-helper.ts'

test('string rules match whole text case-insensitively, or substrings with contains', async () => {
  const handle = createAutoReplyHandler({
    rules: [
      { match: 'hi', reply: 'Hello!' },
      { contains: true, match: 'price', reply: 'See /pricing' },
    ],
  })

  const exact = fakeMessage('  HI ')
  assert.equal(await handle(exact), 1)
  assert.deepEqual(exact.replies, [ 'Hello!' ])

  const notExact = fakeMessage('hi there')
  assert.equal(await handle(notExact), 0)

  const contains = fakeMessage('what is the PRICE?')
  await handle(contains)
  assert.deepEqual(contains.replies, [ 'See /pricing' ])
})

test('regex rules pass the match to function replies', async () => {
  const handle = createAutoReplyHandler({
    rules: [ { match: /weather in (\w+)/gi, reply: (_m, match) => `Weather for ${match?.[1]}` } ],
  })
  const m1 = fakeMessage('weather in Lahore')
  const m2 = fakeMessage('Weather in Karachi')
  await handle(m1)
  await handle(m2)
  assert.deepEqual(m1.replies, [ 'Weather for Lahore' ])
  assert.deepEqual(m2.replies, [ 'Weather for Karachi' ], 'global regex lastIndex must be reset')
})

test('function matchers and firstMatchOnly', async () => {
  const rules = [
    { match: (t: string) => t.length > 3, reply: 'long' },
    { match: /o/, reply: 'has o' },
  ]
  const first = createAutoReplyHandler({ rules })
  const all   = createAutoReplyHandler({ firstMatchOnly: false, rules })

  const m1 = fakeMessage('hello')
  const m2 = fakeMessage('hello')
  await first(m1)
  await all(m2)
  assert.deepEqual(m1.replies, [ 'long' ])
  assert.deepEqual(m2.replies, [ 'long', 'has o' ])
})

test('room policy, self messages and empty text are respected', async () => {
  const rules = [ { match: 'hi', reply: 'Hello!' } ]

  const noRooms = createAutoReplyHandler({ rooms: false, rules })
  assert.equal(await noRooms(fakeMessage('hi', { roomId: 'r' })), 0)

  const mention = createAutoReplyHandler({ requireMentionInRoom: true, rules })
  assert.equal(await mention(fakeMessage('hi', { roomId: 'r' })), 0)
  assert.equal(await mention(fakeMessage('hi', { mentioned: true, roomId: 'r' })), 1)

  const base = createAutoReplyHandler({ rules })
  assert.equal(await base(fakeMessage('hi', { self: true })), 0)
  assert.equal(await base(fakeMessage('')), 0)
})

test('rate limit only counts matched messages', async () => {
  const handle = createAutoReplyHandler({
    rateLimit: { intervalMs: 60_000, limit: 1 },
    rules: [ { match: 'hi', reply: 'Hello!' } ],
  })
  assert.equal(await handle(fakeMessage('random chatter')), 0)
  assert.equal(await handle(fakeMessage('hi')), 1, 'chatter must not consume quota')
  assert.equal(await handle(fakeMessage('hi')), 0, 'second match is throttled')
})

test('AutoReply() plugin wires and unwires the message listener', async () => {
  const bot = new EventEmitter()
  const uninstall = AutoReply({ rules: [ { match: 'hi', reply: 'Hello!' } ] })(bot as any) as () => void
  const m = fakeMessage('hi')
  bot.emit('message', m)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(m.replies, [ 'Hello!' ])
  uninstall()
  assert.equal(bot.listenerCount('message'), 0)
})
