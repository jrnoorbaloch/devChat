#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'

import {
  CommandRouter,
  createCommandHandler,
  parseCommand,
}                             from './command-router.ts'
import { fakeMessage }        from './fake-message.test-helper.ts'

test('parseCommand() splits command and arguments', () => {
  assert.equal(parseCommand('hello'), undefined)
  assert.equal(parseCommand('/'), undefined)
  assert.deepEqual(parseCommand('/ping'), { args: [], command: 'ping', rawArgs: '' })
  assert.deepEqual(
    parseCommand('  /say  hello   world '),
    { args: [ 'hello', 'world' ], command: 'say', rawArgs: 'hello   world' },
  )
  assert.deepEqual(
    parseCommand('/todo add "buy milk" \'call mom\' now')?.args,
    [ 'add', 'buy milk', 'call mom', 'now' ],
    'quotes should group words',
  )
  assert.deepEqual(parseCommand('!ban bob', '!')?.command, 'ban', 'custom prefix')
  assert.deepEqual(parseCommand('/note "unterminated text')?.args, [ 'unterminated text' ])
  assert.throws(() => parseCommand('/x', ''), RangeError)
})

test('createCommandHandler() dispatches and replies with the returned value', async () => {
  const handle = createCommandHandler({
    commands: {
      echo: { aliases: [ 'e' ], description: 'Repeat text', handler: ({ rawArgs }) => rawArgs },
      ping: () => 'pong',
      silent: () => undefined,
    },
  })

  const m1 = fakeMessage('/ping')
  assert.equal(await handle(m1), true)
  assert.deepEqual(m1.replies, [ 'pong' ])

  const m2 = fakeMessage('/E hi there')
  await handle(m2)
  assert.deepEqual(m2.replies, [ 'hi there' ], 'aliases should be case-insensitive by default')

  const m3 = fakeMessage('/silent')
  assert.equal(await handle(m3), true)
  assert.deepEqual(m3.replies, [], 'undefined return should not reply')

  const m4 = fakeMessage('just chatting')
  assert.equal(await handle(m4), false)

  const m5 = fakeMessage('/unknown')
  assert.equal(await handle(m5), false, 'unknown commands are ignored by default')
  assert.deepEqual(m5.replies, [])
})

test('built-in /help lists commands with descriptions and aliases', async () => {
  const handle = createCommandHandler({
    commands: {
      echo: { aliases: [ 'e' ], description: 'Repeat text', handler: () => '' },
      ping: () => 'pong',
    },
  })
  const m = fakeMessage('/help')
  await handle(m)
  const text = String(m.replies[0])
  assert.match(text, /\/echo \(\/e\) - Repeat text/)
  assert.match(text, /\/ping/)
  assert.match(text, /\/help - List available commands/)
  assert.equal(text.match(/\/echo/g)?.length, 1, 'aliases should not duplicate entries')
})

test('help can be disabled and unknownReply can be enabled', async () => {
  const handle = createCommandHandler({
    commands: { ping: () => 'pong' },
    help: false,
    unknownReply: 'Unknown command: {command}',
  })
  const m = fakeMessage('/help')
  assert.equal(await handle(m), true)
  assert.deepEqual(m.replies, [ 'Unknown command: help' ])
})

test('ignores self messages and enforces room mention policy', async () => {
  const handle = createCommandHandler({ commands: { ping: () => 'pong' }, requireMentionInRoom: true })

  const self = fakeMessage('/ping', { self: true })
  assert.equal(await handle(self), false)

  const roomNoMention = fakeMessage('/ping', { roomId: 'r1' })
  assert.equal(await handle(roomNoMention), false)

  const roomMention = fakeMessage('/ping', { mentioned: true, roomId: 'r1' })
  await handle(roomMention)
  assert.deepEqual(roomMention.replies, [ 'pong' ])

  const direct = fakeMessage('/ping')
  await handle(direct)
  assert.deepEqual(direct.replies, [ 'pong' ], 'direct chats never require a mention')
})

test('rate limits per talker', async () => {
  const handle = createCommandHandler({
    commands: { ping: () => 'pong' },
    rateLimit: { intervalMs: 60_000, limit: 1 },
    rateLimitedReply: 'slow down',
  })
  const a1 = fakeMessage('/ping', { talkerId: 'a' })
  const a2 = fakeMessage('/ping', { talkerId: 'a' })
  const b1 = fakeMessage('/ping', { talkerId: 'b' })
  await handle(a1)
  await handle(a2)
  await handle(b1)
  assert.deepEqual(a1.replies, [ 'pong' ])
  assert.deepEqual(a2.replies, [ 'slow down' ])
  assert.deepEqual(b1.replies, [ 'pong' ])
})

test('handler errors are isolated and reported to onError', async () => {
  const errors: unknown[] = []
  const handle = createCommandHandler({
    commands: { boom: () => { throw new Error('kaboom') } },
    onError: e => errors.push(e),
  })
  const m = fakeMessage('/boom')
  assert.equal(await handle(m), true)
  assert.equal((errors[0] as Error).message, 'kaboom')
})

test('duplicate names/aliases throw at construction', () => {
  assert.throws(() => createCommandHandler({
    commands: { a: { aliases: [ 'b' ], handler: () => '' }, b: () => '' },
  }), /duplicate/)
})

test('CommandRouter() plugin subscribes to message and uninstalls cleanly', async () => {
  const bot = new EventEmitter()
  const uninstall = CommandRouter({ commands: { ping: () => 'pong' } })(bot as any)
  assert.equal(bot.listenerCount('message'), 1)

  const m = fakeMessage('/ping')
  bot.emit('message', m)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(m.replies, [ 'pong' ])

  assert.equal(typeof uninstall, 'function')
  ;(uninstall as () => void)()
  assert.equal(bot.listenerCount('message'), 0)
})
