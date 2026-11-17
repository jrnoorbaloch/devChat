#!/usr/bin/env node

import { test } from 'node:test'
import assert from 'node:assert/strict'

import * as DEVCHAT from './mod.ts'
import type { Sayable } from './mod.ts'
import type { Contact } from './users.ts'
import type { ContactImpl } from './impls.ts'
import type { DevChatImpl } from './impls.ts'

function publicTypeContract (bot: DEVCHAT.DevChat, contact: Contact) {
  bot.on('message', message => {
    const messageId: string = message.id
    void message.say('hello')
    void messageId
  })
  bot.on('login', loggedInContact => {
    const contactId: string = loggedInContact.id
    void contactId
  })

  const sayableText: Sayable = 'hello'
  void bot.say(sayableText)
  void bot.say(contact)

  type BoundContactImplementation = ContactImpl
  type ImplementationConstructor = typeof DevChatImpl
  const implementationConstructor: ImplementationConstructor = DEVCHAT.impls.DevChatImpl
  void implementationConstructor
  type PublicContactHasId = BoundContactImplementation['id']
  const publicContactHasId: PublicContactHasId = contact.id
  void publicContactHasId

  // @ts-expect-error Internal options are not part of the public interface.
  bot.__options
}
void publicTypeContract

test('Export of the Framework', async _t => {
  assert.ok(DEVCHAT.impls,     'should export impls.*')
  assert.ok(DEVCHAT.types,     'should export types.*')
  assert.ok(DEVCHAT.IoClient,  'should export IoClient')
  assert.ok(DEVCHAT.log,       'should export log')
})

test('Config setting', async _t => {
  assert.ok(DEVCHAT.config, 'should export Config')
  // assert.ok(config.default.DEFAULT_PUPPET  , 'should has DEFAULT_PUPPET')
})

test('devChat brand exports and built-in plugins', async _t => {
  assert.equal(DEVCHAT.DevChatBuilder, DEVCHAT.DevChatBuilder, 'DevChatBuilder should alias DevChatBuilder')
  assert.equal(typeof DEVCHAT.CommandRouter, 'function', 'should export CommandRouter')
  assert.equal(typeof DEVCHAT.AutoReply, 'function', 'should export AutoReply')
  assert.equal(typeof DEVCHAT.RateLimiter, 'function', 'should export RateLimiter')
  assert.equal(typeof DEVCHAT.envSetting, 'function', 'should export envSetting')
  assert.ok(DEVCHAT.plugins.parseCommand, 'should export plugins namespace')
})
