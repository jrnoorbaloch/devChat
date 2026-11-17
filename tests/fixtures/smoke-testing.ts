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
import {
  DevChatBuilder,
  VERSION,
}                   from 'devchat'
import type { DevChat } from 'devchat'

import * as USERS from 'devchat/users'
import * as IMPLS from 'devchat/impls'

import assert from 'assert'

function publicTypeContract (bot: DevChat, contact: USERS.Contact) {
  bot.on('message', message => {
    const messageId: string = message.id
    void message.say('hello')
    void messageId
  })

  const sayable: import('devchat').Sayable = contact
  void bot.say(sayable)

  const implementationConstructor: typeof IMPLS.DevChatImpl = IMPLS.DevChatImpl
  void implementationConstructor

  // @ts-expect-error Internal options are not part of the public interface.
  bot.__options
}
void publicTypeContract

function getBotList (): DevChat[] {
  const botList = [
    DevChatBuilder.build({ puppet: 'wechaty-puppet-mock' }),
    // new DevChat({ puppet: 'wechaty-puppet-wechat4u' }),
    // new DevChat({ puppet: 'wechaty-puppet-puppeteer' }),
  ]

  if (process.env.DEVCHAT_PUPPET_SERVICE_TOKEN) {
    botList.push(
      DevChatBuilder.build({
        puppet: 'wechaty-puppet-service',
      })
    )
  }
  if (process.env.DEVCHAT_PUPPET_PADLOCAL_TOKEN) {
    botList.push(
      DevChatBuilder.build({
        puppet: 'wechaty-puppet-padlocal',
      })
    )
  }

  return botList
}

async function main () {
  const botList = getBotList()
  try {
    await Promise.all(
      botList.map(bot => bot.start()),
    )
    for (const bot of botList) {
      console.info(`DevChat v${bot.version()} smoking test passed.`)
    }
  } catch (e) {
    console.error(e)
    // Error!
    return 1
  } finally {
    await Promise.all(
      botList.map(bot => bot.stop()),
    )
  }

  const tag: USERS.Tag = {} as any as IMPLS.TagImpl
  assert.ok(tag, 'should get valid USERS & IMPLS')

  assert.notStrictEqual(VERSION,  '0.0.0', 'VERSION must be set!')

  return 0
}

main()
  .then(process.exit)
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
