#!/usr/bin/env node

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type {
  DevChatSkeleton,
  DevChatSkeletonProtectedProperty,
}                                         from './devchat-skeleton.ts'

test('ProtectedPropertyDevChatSkeleton', async _t => {
  type NotExistInMixin = Exclude<DevChatSkeletonProtectedProperty, keyof DevChatSkeleton>
  type NotExistTest = NotExistInMixin extends never ? true : false

  const noOneLeft: NotExistTest = true
  assert.ok(noOneLeft, 'should match Mixin properties for every protected property')
})
