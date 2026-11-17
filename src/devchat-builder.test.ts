#!/usr/bin/env node
/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *   Modified from Wechaty Chatbot SDK - https://github.com/wechaty/wechaty
 *
 *   @copyright 2016 Huan LI (李卓桓) <https://github.com/huan>, and
 *                   Wechaty Contributors <https://github.com/wechaty>.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PuppetMock } from 'wechaty-puppet-mock'

import { DevChatBuilder } from './devchat-builder.ts'

test('DevChatBuilder class', async t => {
  const devchat1 = DevChatBuilder.build()
  const devchat2 = DevChatBuilder.build()
  assert.notStrictEqual(devchat1, devchat2, 'should build two different DevChat instance')

  const singleton1 = DevChatBuilder.singleton()
  const singleton2 = DevChatBuilder.singleton()
  assert.equal(singleton1, singleton2, 'should get the same singleton instance')

  const devchat = DevChatBuilder.build({ puppet: new PuppetMock() })
  let started = false
  t.after(async () => {
    if (started) {
      await devchat.stop()
    }
  })
  started = true
  await devchat.start()
  assert.ok(PuppetMock.validInstance(devchat.puppet), 'should set options.puppet to mock')
  await devchat.stop()
  started = false
})

test('throw when set options twice', async _t => {
  class DevChatBuilderTest extends DevChatBuilder {

    constructor () { super() }

    static override new () { return new this() }

    override options (...args: any[]) {
      super.options(...args)
      return this
    }

  }

  const builder = DevChatBuilderTest.new()
  assert.doesNotThrow(() => builder.options({}), 'should not throw for the first time')
  assert.doesNotThrow(() => builder.options({}), 'should not throw as long as the `options` is an empty object')

  const options = { name: 'bot' }
  assert.doesNotThrow(() => builder.options(options), 'should not throw for setting non-empty `options` for the first time')
  assert.throws(() => builder.options(options), 'should throw for setting non-empty `options` again')
})

test('DevChatBuilder class static', async t => {
  const devchat1 = DevChatBuilder.build()
  const devchat2 = DevChatBuilder.build()
  assert.notStrictEqual(devchat1, devchat2, 'should build two different DevChat instance')

  const singleton1 = DevChatBuilder.singleton()
  const singleton2 = DevChatBuilder.singleton()
  assert.equal(singleton1, singleton2, 'should get the same singleton instance')

  const devchat = DevChatBuilder.build({ puppet: new PuppetMock() })
  let started = false
  t.after(async () => {
    if (started) {
      await devchat.stop()
    }
  })
  started = true
  await devchat.start()
  assert.ok(PuppetMock.validInstance(devchat.puppet), 'should set options.puppet to mock')
  await devchat.stop()
  started = false
})
