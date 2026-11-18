#!/usr/bin/env node
/**
 * Runner tests drive real devChat bots on `wechaty-puppet-mock`, so the
 * multi-messenger wiring is checked end to end without a phone or network.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PuppetMock } from 'wechaty-puppet-mock'

import { DevChatBuilder } from '../devchat-builder.ts'
import { writeProjectConfig } from './config-file.ts'
import {
  chooseMessengers,
  createDriverErrorHandler,
  createRepeatFilter,
  describeError,
  installDriverErrorGuard,
  startDevChat,
} from './runner.ts'

test('chooseMessengers(): options > config file > env > WeChat', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devchat-run-'))
  assert.deepEqual(chooseMessengers({ cwd: dir }, {}), [ 'wechat' ])
  assert.deepEqual(chooseMessengers({ cwd: dir }, { DEVCHAT_MESSENGERS: 'whatsapp' }), [ 'whatsapp' ])
  writeProjectConfig(dir, { messengers: [ 'wechat', 'whatsapp' ] })
  assert.deepEqual(chooseMessengers({ cwd: dir }, { DEVCHAT_MESSENGERS: 'whatsapp' }), [ 'wechat', 'whatsapp' ])
  assert.deepEqual(chooseMessengers({ cwd: dir, messengers: [ 'whatsapp' ] }), [ 'whatsapp' ])
})

test('startDevChat() starts one bot per messenger and runs setup on each', async () => {
  const seen: string[] = []
  const bots = await startDevChat({
    buildBot: id => DevChatBuilder.build({ name: `test-${id}`, puppet: new PuppetMock() }),
    guardDriverErrors: false,
    handleSignals: false,
    messengers: [ 'wechat', 'whatsapp' ],
    setup: (_bot, label, id) => { seen.push(`${label}:${id}`) },
    showQrInTerminal: false,
  })
  try {
    assert.equal(bots.length, 2)
    assert.deepEqual(seen, [ 'WeChat:wechat', 'WhatsApp:whatsapp' ])
    assert.ok(bots.every(b => b.isLoggedIn === false), 'started but not logged in yet')
  } finally {
    await Promise.all(bots.map(b => b.stop()))
  }
})

test('startDevChat() rejects with a clear message when nothing starts', async () => {
  await assert.rejects(
    startDevChat({
      buildBot: () => {
        const bot = DevChatBuilder.build({ puppet: new PuppetMock() })
        bot.start = async () => { throw new Error('boom') }
        return bot
      },
      handleSignals: false,
      messengers: [ 'wechat' ],
      showQrInTerminal: false,
    }),
    /npm run setup/,
  )
})

test('createRepeatFilter() hides identical messages inside the window', () => {
  let now = 0
  const show = createRepeatFilter(1000, () => now)
  assert.equal(show('403'), true)
  assert.equal(show('403'), false)
  assert.equal(show('other'), true, 'different messages are independent')
  now = 1500
  assert.equal(show('403'), true, 'shown again after the window')
})

test('describeError() handles Errors, driver error objects and strings', () => {
  assert.equal(describeError(new Error('boom')), 'boom')
  // Shape of the WhatsApp driver error from the report: [ERR_INIT: no cache manager] { code: 1001 }
  const waError = Object.assign(new Error('no cache manager'), { code: 1001, name: 'ERR_INIT' })
  assert.equal(describeError(waError), 'no cache manager')
  assert.equal(describeError({ name: 'ERR_INIT' }), 'ERR_INIT')
  assert.equal(describeError('plain'), 'plain')
})

test('driver error handler prints once per message and stack only in debug', () => {
  const lines: string[] = []
  const handle = createDriverErrorHandler(l => lines.push(l), {})
  handle(new Error('no cache manager'))
  handle(new Error('no cache manager'))
  assert.equal(lines.length, 1)
  assert.match(lines[0]!, /kept running: no cache manager/)

  const debugLines: string[] = []
  createDriverErrorHandler(l => debugLines.push(l), { DEVCHAT_DEBUG: '1' })(new Error('x'))
  assert.equal(debugLines.length, 2, 'message + stack')
})

test('installDriverErrorGuard() keeps the process alive on an unhandled driver rejection', {
  // Runs in a child Node.js process: the test runner itself treats unhandled
  // rejections as failures. Deno's test permissions do not allow spawning it.
  skip: 'Deno' in globalThis,
}, async () => {
  const { spawnSync } = await import('node:child_process')
  // A file:// URL, not a path: import() rejects bare Windows paths (C:\\...).
  const runner = new URL('./runner.ts', import.meta.url).href
  const script = `
    const { installDriverErrorGuard } = await import(${JSON.stringify(runner)})
    const { EventEmitter } = await import('node:events')
    installDriverErrorGuard()
    // Same pattern as the WhatsApp driver: an async event handler that throws.
    const client = new EventEmitter()
    client.on('group_update', async () => { throw Object.assign(new Error('no cache manager'), { code: 1001 }) })
    client.emit('group_update', {})
    await new Promise(resolve => setTimeout(resolve, 200))
    console.log('STILL_RUNNING')
  `
  const r = spawnSync(process.execPath, [ '--input-type=module', '-e', script ], { encoding: 'utf8', timeout: 60_000 })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /STILL_RUNNING/)
  assert.match(r.stderr, /kept running: no cache manager/)

  const remove = installDriverErrorGuard(() => {})
  const before = process.listenerCount('unhandledRejection')
  remove()
  assert.equal(process.listenerCount('unhandledRejection'), before - 1, 'guard can be removed')
})
