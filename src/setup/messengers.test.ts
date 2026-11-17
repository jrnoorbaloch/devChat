#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MESSENGERS,
  isMessengerId,
  parseMessengerChoice,
  resolvePuppetAlias,
} from './messengers.ts'

test('parseMessengerChoice() accepts numbers, names, both and lists', () => {
  assert.deepEqual(parseMessengerChoice('1'), [ 'wechat' ])
  assert.deepEqual(parseMessengerChoice('2'), [ 'whatsapp' ])
  assert.deepEqual(parseMessengerChoice('3'), [ 'wechat', 'whatsapp' ])
  assert.deepEqual(parseMessengerChoice(' WhatsApp '), [ 'whatsapp' ])
  assert.deepEqual(parseMessengerChoice('both'), [ 'wechat', 'whatsapp' ])
  assert.deepEqual(parseMessengerChoice('whatsapp,wechat'), [ 'wechat', 'whatsapp' ], 'menu order, deduplicated')
  assert.deepEqual(parseMessengerChoice('wechat and whatsapp'), [ 'wechat', 'whatsapp' ])
  assert.deepEqual(parseMessengerChoice('wa wa'), [ 'whatsapp' ])
})

test('parseMessengerChoice() rejects empty or unknown answers', () => {
  assert.equal(parseMessengerChoice(''), undefined)
  assert.equal(parseMessengerChoice('   '), undefined)
  assert.equal(parseMessengerChoice('telegram'), undefined)
  assert.equal(parseMessengerChoice('4'), undefined)
  assert.equal(parseMessengerChoice('wechat, telegram'), undefined, 'one bad token rejects the answer')
})

test('resolvePuppetAlias() maps friendly names and passes others through', () => {
  assert.equal(resolvePuppetAlias('whatsapp'), MESSENGERS.whatsapp.puppet)
  assert.equal(resolvePuppetAlias(' WeChat '), MESSENGERS.wechat.puppet)
  assert.equal(resolvePuppetAlias('wechaty-puppet-mock'), 'wechaty-puppet-mock')
})

test('registry invariants', () => {
  assert.equal(isMessengerId('wechat'), true)
  assert.equal(isMessengerId('x'), false)
  assert.equal(MESSENGERS.wechat.installSpec, undefined, 'WeChat driver ships with devChat')
  assert.match(MESSENGERS.whatsapp.installSpec ?? '', /^wechaty-puppet-whatsapp@\d/, 'WhatsApp driver must be pinned')
})
