#!/usr/bin/env node
/**
 * Verifies puppet-mixin contracts for forward-event failures, public event
 * timing, and listener persistence across repeated initialization and service
 * lifecycles.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { function as FP } from 'fp-ts'
import * as PUPPET from 'wechaty-puppet'
import { PuppetMock } from 'wechaty-puppet-mock'

import '../devchat/devchat-impl.ts'

import {
  gErrorMixin,
}                             from '../devchat-mixins/mod.ts'
import { DevChatBase } from '../devchat/devchat-base.ts'
import { DevChatSkeleton } from '../devchat/devchat-skeleton.ts'
import { ioMixin } from './io-mixin.ts'
import { devchatifyUserModuleMixin } from './devchatify-user-module-mixin.ts'

import type {
  PuppetMixin,
  ProtectedPropertyPuppetMixin,
}                                             from './puppet-mixin.ts'
import { puppetMixin } from './puppet-mixin.ts'

test('ProtectedPropertyPuppetMixin', async _t => {
  type NotExistInMixin = Exclude<ProtectedPropertyPuppetMixin, keyof InstanceType<PuppetMixin>>
  type NotExistTest = NotExistInMixin extends never ? true : false

  const noOneLeft: NotExistTest = true
  assert.ok(noOneLeft, 'should match Mixin properties for every protected property')
})

test('__setupPuppetEvents() should reject unsupported puppet events', async _t => {
  const mixinBase = FP.pipe(
    DevChatSkeleton,
    gErrorMixin,
    ioMixin,
    devchatifyUserModuleMixin,
    puppetMixin,
  )

  class PuppetMixinTest extends mixinBase {}

  const devchat = new PuppetMixinTest({ puppet: 'wechaty-puppet-mock' })

  const fakePuppet = {
    currentUserId: 'test-user',
    listenerCount: () => 0,
    on: () => fakePuppet,
    roomMemberPayloadDirty: async () => {},
    roomPayloadDirty: async () => {},
  } as any as PUPPET.impls.PuppetInterface

  const eventDict = PUPPET.types.PUPPET_EVENT_DICT as unknown as Record<string, unknown>
  const unknownEventName = '__future-unknown-event__'
  const hadUnknownEvent = Object.hasOwn(eventDict, unknownEventName)
  const oldUnknownEvent = eventDict[unknownEventName]

  eventDict[unknownEventName] = undefined
  try {
    assert.throws(
      () => (devchat as any).__setupPuppetEvents(fakePuppet),
      /eventName __future-unknown-event__ unsupported!/,
      'should reject setup when an unknown puppet event exists',
    )
  } finally {
    if (hadUnknownEvent) {
      eventDict[unknownEventName] = oldUnknownEvent
    } else {
      delete eventDict[unknownEventName]
    }
  }
})

test('puppet event registration stays single across init and service cycles', async () => {
  const puppet = new PuppetMock()
  const bot = new DevChatBase({ puppet })
  let puppetEventBeforeGetterAssignment = false

  bot.on('puppet', eventPuppet => {
    assert.equal(eventPuppet, puppet, 'should emit the resolved puppet')
    assert.throws(() => bot.puppet, 'should emit puppet before assigning the public getter')
    puppetEventBeforeGetterAssignment = true
  })

  await bot.init()
  const listenerCount = puppet.listenerCount('message')
  await bot.init()

  await bot.start()
  await bot.stop()
  await bot.start()
  await bot.stop()

  assert.ok(puppetEventBeforeGetterAssignment, 'should emit the compatibility event during initial setup')
  assert.equal(listenerCount, 1, 'should register one message listener')
  assert.equal(puppet.listenerCount('message'), listenerCount, 'should keep the same listener registration across lifecycle cycles')
})
