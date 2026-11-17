#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import PuppetMock from 'wechaty-puppet-mock'

import { DevChatEventEmitter } from '../schemas/devchat-events.ts'

import type {
  ContactSelfConstructor,
  ContactConstructor,
  FriendshipConstructor,
  ImageConstructor,
  LocationConstructor,
  MessageConstructor,
  MiniProgramConstructor,
  PostConstructor,
  RoomInvitationConstructor,
  RoomConstructor,
  DelayConstructor,
  TagConstructor,
  UrlLinkConstructor,
  MessageInterface,
}                             from '../user-modules/mod.ts'

import {
  type DevChatConstructor,
  type DevChatInterface,
  type AllProtectedProperty,
  DevChatImpl,
  // DevChatConstructor,
}                       from './devchat-impl.ts'

test('DevChat interface', async _t => {
  abstract class DevChatImplementation extends DevChatEventEmitter implements DevChatInterface {

    Contact        : ContactConstructor
    ContactSelf    : ContactSelfConstructor
    Delay          : DelayConstructor
    Friendship     : FriendshipConstructor
    Image          : ImageConstructor
    Location       : LocationConstructor
    Message        : MessageConstructor
    MiniProgram    : MiniProgramConstructor
    Post           : PostConstructor
    Room           : RoomConstructor
    RoomInvitation : RoomInvitationConstructor
    Tag            : TagConstructor
    UrlLink        : UrlLinkConstructor

    constructor () {
      super()
      // this.puppet
      this.Contact
        = this.ContactSelf
        = this.Delay
        = this.Friendship
        = this.Image
        = this.Location
        = this.Message
        = this.MiniProgram
        = this.Post
        = this.Room
        = this.RoomInvitation
        = this.Tag
        = this.UrlLink
        = {} as any
    }

    abstract authQrCode  : DevChatInterface['authQrCode']
    abstract currentUser : DevChatInterface['currentUser']
    abstract ding        : DevChatInterface['ding']
    abstract emitError   : DevChatInterface['emitError']
    abstract id          : DevChatInterface['id']
    abstract init        : DevChatInterface['init']
    abstract isLoggedIn  : DevChatInterface['isLoggedIn']
    abstract log         : DevChatInterface['log']
    abstract logout      : DevChatInterface['logout']
    abstract name        : DevChatInterface['name']
    abstract publish     : DevChatInterface['publish']
    abstract puppet      : DevChatInterface['puppet']
    abstract ready       : DevChatInterface['ready']
    abstract reset       : DevChatInterface['reset']
    abstract say         : DevChatInterface['say']
    abstract sleep       : DevChatInterface['sleep']
    abstract start       : DevChatInterface['start']
    abstract state       : DevChatInterface['state']
    abstract stop        : DevChatInterface['stop']
    abstract use         : DevChatInterface['use']
    abstract version     : DevChatInterface['version']
    abstract wrapAsync   : DevChatInterface['wrapAsync']

  }

  const DevChatTest = DevChatImplementation as unknown as DevChatConstructor
  const w: DevChatInterface = new DevChatTest()
  w.on('message', (msg: MessageInterface) => {
    msg.say('ok').catch(console.error)
  })

  assert.ok(typeof DevChatImplementation, 'should no typing error')
})

test('ProtectedProperties', async _t => {
  type NotExistInDevChat = Exclude<AllProtectedProperty, keyof DevChatImpl | `_${string}`>
  type NotExistTest = NotExistInDevChat extends never ? true : false

  const noOneLeft: NotExistTest = true
  assert.ok(noOneLeft, 'should match DevChat properties for every protected property')
})

test('options.puppet initialization', async _t => {
  const puppet  = new PuppetMock()
  const devchat = new DevChatImpl({ puppet })
  assert.throws(() => devchat.puppet, 'should throw when access puppet getter before init()')

  await devchat.init()
  assert.doesNotThrow(() => devchat.puppet, 'should not throw when access puppet getter after init()')
  assert.ok(devchat.puppet, 'should exist puppet instance by setting the options.puppet')
})
