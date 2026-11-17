#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { function as FP } from 'fp-ts'

/**
 * Huan(202201): must import `./devchat-impl.js` first
 *
 * Or will throw error:
 *
 * ReferenceError: Cannot access 'devchatifyUserModuleMixin' before initialization
 *   at file:///home/huan/git/devchat/src/devchat/devchat-base.ts:58:3 *
 *
 * TODO: find out why
 */
import '../devchat/devchat-impl.ts'

import {
  gErrorMixin,
}                             from '../devchat-mixins/mod.ts'

import {
  DevChatSkeleton,
}                             from '../devchat/devchat-skeleton.ts'

import {
  pluginMixin,
  type PluginMixin,
  type ProtectedPropertyPluginMixin,
}                                             from './plugin-mixin.ts'
import { miscMixin } from './misc-mixin.ts'
import { puppetMixin } from './puppet-mixin.ts'
import { ioMixin } from './io-mixin.ts'
import { devchatifyUserModuleMixin } from './devchatify-user-module-mixin.ts'

test('ProtectedPropertyPluginMixin', async _t => {
  type NotExistInMixin = Exclude<ProtectedPropertyPluginMixin, keyof InstanceType<PluginMixin>>
  type NotExistTest = NotExistInMixin extends never ? true : false

  const noOneLeft: NotExistTest = true
  assert.ok(noOneLeft, 'should match Mixin properties for every protected property')
})

test('PluginMixin smoke testing', async t => {
  const mixinBase = FP.pipe(
    DevChatSkeleton,
    gErrorMixin,
    ioMixin,
    devchatifyUserModuleMixin,
    puppetMixin,
    miscMixin,
    pluginMixin,
  )

  class PluginMixinTest extends mixinBase {

    counter = 0

  }

  const Plugin = (devchat: any) => {
    devchat.counter++
    return () => devchat.counter--
  }

  const pluginMixinTest = new PluginMixinTest({ puppet: 'wechaty-puppet-mock' })
  let started = false
  t.after(async () => {
    if (started) {
      await pluginMixinTest.stop()
    }
  })

  const unuse = pluginMixinTest.use(Plugin)

  assert.equal(pluginMixinTest.counter, 1, 'should call plugin function right after use before start')
  started = true
  const future = pluginMixinTest.start()
  assert.equal(pluginMixinTest.counter, 1, 'should call plugin function right after start')

  await future
  // assert.equal(pluginMixinTest.counter, 1, 'should call plugin function after start')

  await pluginMixinTest.stop()
  started = false
  assert.equal(pluginMixinTest.counter, 1, 'should not clean plugin context after stop')

  unuse()
  assert.equal(pluginMixinTest.counter, 0, 'should clean plugin context after call unuse()')

})
