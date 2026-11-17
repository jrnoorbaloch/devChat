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
  serviceCtlMixin,
}                       from 'state-switch'
import { function as FP } from 'fp-ts'
import type * as PUPPET from 'wechaty-puppet'

import {
  config,
  log,
  VERSION,
}                       from '../config.ts'

import type {
  SayableSayer,
  Sayable,
}                             from '../sayable/mod.ts'
import {
  gErrorMixin,
  ioMixin,
  loginMixin,
  miscMixin,
  pluginMixin,
  puppetMixin,
  devchatifyUserModuleMixin,
}                             from '../devchat-mixins/mod.ts'

import {
  DevChatSkeleton,
}                             from './devchat-skeleton.ts'
import type {
  DevChatInterface,
}                             from './devchat-impl.ts'
import type {
  DevChatOptions,
}                             from '../schemas/devchat-options.ts'
import type { PostInterface } from '../user-modules/post.ts'

const mixinBase = FP.pipe(
  DevChatSkeleton,
  gErrorMixin,
  devchatifyUserModuleMixin,
  ioMixin,
  puppetMixin,
  loginMixin,
  miscMixin,
  pluginMixin,
  /**
   * Huan(202002):
   *
   * The `serviceCtlMixin` must be the most outer mixin
   *  because the `devchat.start/stop()` should first entry `serviceCtlMixin.start/stop()`
   *  which can be managed correctly by the `serviceCtlMixin`
   */
  serviceCtlMixin('DevChat', { log }),
)

/**
 * Huan(2021211): Keep the below call back hell
 *  because it's easy for testing
 *  especially when there's some typing mismatch and we need to figure it out.
 */
// const mixinTest = serviceCtlMixin('DevChat', { log })(
//   pluginMixin(
//     puppetMixin(
//       devchatifyUserModuleMixin(
//         gErrorMixin(
//           DevChatSkeleton,
//         ),
//       ),
//     ),
//   ),
// )

/**
 * Main bot class.
 *
 * A `Bot` is a WeChat client depends on which puppet you use.
 * It may equals
 * - web-WeChat, when you use: puppet-puppeteer/puppet-wechat4u
 * - ipad-WeChat, when you use: puppet-padchat
 * - ios-WeChat, when you use: puppet-ioscat
 *
 * See more:
 * - What is a Puppet in DevChat
 *
 * > If you want to know how to send message, see [Message](#Message) <br>
 * > If you want to know how to get contact, see [Contact](#Contact)
 *
 * @example <caption>The World's Shortest ChatBot Code: 6 lines of JavaScript</caption>
 * import { DevChatBuilder } from 'devchat'
 * const bot = DevChatBuilder.build()
 * bot.on('scan',    (qrCode, status) => console.log('https://devchat-docs.vercel.app/qrcode/' + encodeURIComponent(qrcode)))
 * bot.on('login',   user => console.log(`User ${user} logged in`))
 * bot.on('message', message => console.log(`Message: ${message}`))
 * bot.start()
 */
class DevChatBase extends mixinBase implements SayableSayer {

  override __options: DevChatOptions

  static   override readonly VERSION = VERSION
  readonly devchat : DevChatInterface

  readonly _stopCallbackList: (() => void)[] = []

  /**
   * The term [Puppet](https://devchat-docs.vercel.app) in DevChat is an Abstract Class for implementing protocol plugins.
   * The plugins are the component that helps DevChat to control the WeChat(that's the reason we call it puppet).
   * The plugins are named XXXPuppet, for example:
   * - PuppetWeChat:
   * - PuppetWeChat:
   * - PuppetXP
   *
   * @typedef    PuppetModuleName
   * @property   {string}  PUPPET_DEFAULT
   * The default puppet.
   * @property   {string}  wechaty-puppet-wechat4u
   * The default puppet, using the [wechat4u](https://github.com/nodeWechat/wechat4u) to control the [WeChat Web API](https://wx.qq.com/) via a chrome browser.
   * @property   {string}  wechaty-puppet-service
   * - Using the gRPC protocol to connect with a Protocol Server for controlling the any protocol of any IM  program.
   * @property   {string}  wechaty-puppet-wechat
   * - Using the [google puppeteer](https://github.com/GoogleChrome/puppeteer) to control the [WeChat Web API](https://wx.qq.com/) via a chrome browser.
   * @property   {string}  wechaty-puppet-mock
   * - Using the mock data to mock wechat operation, just for test.
   */

  /**
   * The option parameter to create a devchat instance
   *
   * @typedef    DevChatOptions
   * @property   {string}                 name            -DevChat Name. </br>
   *          When you set this: </br>
   *          `DevChatBuilder.build({name: 'devchat-name'}) ` </br>
   *          it will generate a file called `devchat-name.memory-card.json`. </br>
   *          This file stores the login information for bot. </br>
   *          If the file is valid, the bot can auto login so you don't need to scan the qrCode to login again. </br>
   *          Also, you can set the environment variable for `DEVCHAT_NAME` to set this value when you start. </br>
   *          eg:  `DEVCHAT_NAME="your-cute-bot-name" node bot.js`
   * @property   {PuppetModuleName | Puppet}    puppet             -Puppet name or instance
   * @property   {Partial<PuppetOptions>} puppetOptions      -Puppet TOKEN
   * @property   {string}                 ioToken            -Io TOKEN
   */

  /**
   * Creates an instance of DevChat.
   * @param {DevChatOptions} [options={}]
   *
   */
  constructor (
    __options: DevChatOptions = {},
  ) {
    super(__options)
    this.__options = __options
    log.verbose('DevChat', 'constructor()')

    this.__memory = this.__options.memory
    this.devchat  = this
  }

  override async start (): Promise<void> {
    log.verbose('DevChat', 'start()')
    await this.init()
    return super.start()
  }

  override async onStart (): Promise<void> {
    log.verbose('DevChat', 'onStart()')

    log.verbose('DevChat', '<%s>(%s) onStart() v%s is starting...',
      this.__options.puppet || config.systemPuppetName(),
      this.__options.name   || '',
      this.version(),
    )
    log.verbose('DevChat', 'id: %s', this.id)

    const lifeTimer = setInterval(() => {
      log.silly('DevChat', 'onStart() setInterval() this timer is to keep DevChat running...')
    }, 1000 * 60 * 60)
    this._stopCallbackList.push(() => clearInterval(lifeTimer))

    this.emit('start')
    log.verbose('DevChat', 'onStart() ... done')
  }

  override async onStop (): Promise<void> {
    log.verbose('DevChat', 'onStop()')

    log.verbose('DevChat', '<%s> onStop() v%s is stopping ...',
      this.__options.puppet || config.systemPuppetName(),
      this.version(),
    )

    // put to the end of the event loop in case of it need to be executed while stopping
    this._stopCallbackList.map(setImmediate)
    this._stopCallbackList.length = 0

    this.emit('stop')
    log.verbose('DevChat', 'onStop() ... done')
  }

  /**
   * Send message to currentUser, in other words, bot send message to itself.
   * > Tips:
   * This function is depending on the Puppet Implementation, see [puppet-compatible-table](https://github.com/jrnoorbaloch/devChat/wiki/Puppet#3-puppet-compatible-table)
   *
   * @param {(string | Contact | FileBox | UrlLink | MiniProgram | Location)} sayable
   * send text, Contact, or file to bot. </br>
   * You can use {@link https://www.npmjs.com/package/file-box|FileBox} to send file
   *
   * @returns {Promise<void>}
   *
   * @example
   * const bot = DevChatBuilder.build()
   * await bot.start()
   * // after logged in
   *
   * // 1. send text to bot itself
   * await bot.say('hello!')
   *
   * // 2. send Contact to bot itself
   * const contact = await bot.Contact.find()
   * await bot.say(contact)
   *
   * // 3. send Image to bot itself from remote url
   * import { FileBox }  from 'file-box'
   * const fileBox = FileBox.fromUrl('https://devchat-docs.vercel.app/assets/og.png')
   * await bot.say(fileBox)
   *
   * // 4. send Image to bot itself from local file
   * import { FileBox }  from 'file-box'
   * const fileBox = FileBox.fromFile('/tmp/text.jpg')
   * await bot.say(fileBox)
   *
   * // 5. send Link to bot itself
   * const linkPayload = new UrlLink ({
   *   description : 'WeChat Bot SDK for Individual Account, Powered by TypeScript, Docker, and Love',
   *   thumbnailUrl: 'https://avatars0.githubusercontent.com/u/25162437?s=200&v=4',
   *   title       : 'Welcome to DevChat',
   *   url         : 'https://github.com/jrnoorbaloch/devChat',
   * })
   * await bot.say(linkPayload)
   *
   * // 6. send MiniProgram to bot itself
   * const miniPayload = new MiniProgram ({
   *   username           : 'gh_xxxxxxx',     //get from mp.weixin.qq.com
   *   appid              : '',               //optional, get from mp.weixin.qq.com
   *   title              : '',               //optional
   *   pagepath           : '',               //optional
   *   description        : '',               //optional
   *   thumbnailurl       : '',               //optional
   * })
   * await bot.say(miniPayload)
   */

  async say (
    sayable: Sayable,
  ): Promise<void> {
    log.verbose('DevChat', 'say(%s)', sayable)
    await this.currentUser.say(sayable)
  }

  async publish (
    post: PostInterface,
  ): Promise<void | PostInterface> {
    log.verbose('DevChat', 'publish(%s)',
      (post.payload.sayableList as PUPPET.payloads.Sayable[])
        .map(s => s.type).join(','),
    )
    const postId = await this.puppet.postPublish(post.payload)

    if (postId) {
      return this.Post.find({ id: postId })
    }
  }

}

type DevChatBaseProtectedProperty =
  // | '_serviceCtlFsmInterpreter'  // from ServiceCtlFsm
  | '__serviceCtlLogger'             // from ServiceCtl(&Fsm)
  | '__serviceCtlResettingIndicator' // from ServiceCtl
  | 'devchat'
  | 'onStart'
  | 'onStop'

export type {
  DevChatBaseProtectedProperty,
}
export {
  DevChatBase,
}
