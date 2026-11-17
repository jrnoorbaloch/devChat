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
import { chooseMessengers, createRepeatFilter, startDevChat } from './runner.ts'

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
