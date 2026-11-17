#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { DevChat } from '../mods/mod.ts'

import {
  isWechatified,
  devchatifyMixin,
  devchatifyUserModule,
}                       from './devchatify.ts'

const devchat = {
  puppet: {} as any,
} as any as DevChat

test('isWechatified()', async _t => {

  class UserClassTest extends devchatifyMixin(Object) {}
  assert.ok(!isWechatified(UserClassTest), 'should not be wechatified')
  assert.throws(() => UserClassTest.devchat, 'should throw before wechatified')

  const WechatifiedUserClass = devchatifyUserModule(UserClassTest)(devchat)
  assert.ok(isWechatified(WechatifiedUserClass), 'should be wechatified')
  assert.doesNotThrow(() => WechatifiedUserClass.devchat, 'should not throw after wechatified')

  const user: UserClassTest = new WechatifiedUserClass()
  assert.ok(user, 'should be able to assign with the correct typing')
})
