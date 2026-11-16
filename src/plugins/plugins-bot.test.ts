#!/usr/bin/env node
/**
 * End-to-end check of the built-in plugins on a real devChat bot driven by
 * `wechaty-puppet-mock`: a mock user sends messages, and we assert on the text
 * the bot sends back through the puppet.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PuppetMock } from 'wechaty-puppet-mock'

import { DevChatBuilder } from '../mods/mod.ts'
import { AutoReply, CommandRouter } from './mod.ts'

test('CommandRouter and AutoReply reply through a running bot', async () => {
  const puppet = new PuppetMock()
  const bot = DevChatBuilder.build({ puppet })

  const sent: string[] = []
  const original = puppet.messageSendText.bind(puppet)
  puppet.messageSendText = async (conversationId: string, text: string) => {
    sent.push(text)
    return original(conversationId, text)
  }

  bot.use(
    CommandRouter({ commands: { ping: () => 'pong' } }),
    AutoReply({ rules: [ { match: 'hi', reply: 'Hello from devChat' } ] }),
  )

  const botUser = puppet.mocker.createContact({ name: 'Bot' })
  const human   = puppet.mocker.createContact({ name: 'Human' })

  await bot.start()
  try {
    await puppet.mocker.login(botUser)

    const waitFor = async (n: number) => {
      for (let i = 0; i < 100 && sent.length < n; i++) {
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    }

    human.say('/ping').to(botUser)
    await waitFor(1)
    human.say('hi').to(botUser)
    await waitFor(2)
    human.say('nothing to see here').to(botUser)
    await new Promise(resolve => setTimeout(resolve, 100))

    assert.deepEqual(sent, [ 'pong', 'Hello from devChat' ])
  } finally {
    await bot.stop()
  }
})
