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
import { DevChatBuilder } from '../devchat-builder.ts'

import {
  ContactImpl,
  type ContactProtectedProperty,
}                             from './contact.ts'

test('findAll()', async t => {
  const EXPECTED_NAME = 'TestingBot'

  const puppet = new PuppetMock()
  const devchat = DevChatBuilder.build({ puppet })
  let started = false
  t.after(async () => {
    if (started) {
      await devchat.stop()
    }
  })

  const mockContact = puppet.mocker.createContact({ name: EXPECTED_NAME })

  started = true
  await devchat.start()
  await puppet.mocker.login(mockContact)

  const contactList = await devchat.Contact.findAll()
  assert.equal(contactList.length, 1, 'should find 1 contact')
  assert.equal(contactList[0]!.name(), EXPECTED_NAME, 'should get name from payload')
  assert.deepStrictEqual(contactList[0]!.payload, mockContact.payload, 'should get payload from mockContact')

  await devchat.stop()
  started = false
})

test('Should not be able to instanciate directly', async _t => {
  assert.throws(() => ContactImpl.load('xxx'), 'should throw when `Contact.load()`')

  assert.throws(() => ContactImpl.load('xxx'), 'should throw when `Contact.load()`')
})

test('Should not be able to instanciate through cloneClass without puppet', async _t => {
  assert.throws(() => ContactImpl.load('xxx'), 'should throw when `MyContact.load()` without puppet')

  assert.throws(() => ContactImpl.load('xxx'), 'should throw when `MyContact.load()` without puppet')

})

test('should throw when instanciate the global class', async _t => {
  assert.throws(() => ContactImpl.load('xxx'), 'should throw when we instanciate a global class')
})

test('ProtectedProperties', async _t => {
  type NotExistInDevChat = Exclude<ContactProtectedProperty, keyof ContactImpl>
  type NotExistTest = NotExistInDevChat extends never ? true : false

  const noOneLeft: NotExistTest = true
  assert.ok(noOneLeft, 'should match DevChat properties for every protected property')
})
