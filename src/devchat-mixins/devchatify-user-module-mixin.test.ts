#!/usr/bin/env node

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type {
  DevChatifyUserModuleMixin,
  ProtectedPropertyDevChatifyUserModuleMixin,
}                                               from './devchatify-user-module-mixin.ts'

test('ProtectedPropertyDevChatifyUserModuleMixin', async _t => {
  type NotExistInMixin = Exclude<ProtectedPropertyDevChatifyUserModuleMixin, keyof InstanceType<DevChatifyUserModuleMixin>>
  type NotExistTest = NotExistInMixin extends never ? true : false

  const noOneLeft: NotExistTest = true
  assert.ok(noOneLeft, 'should match Mixin properties for every protected property')
})
