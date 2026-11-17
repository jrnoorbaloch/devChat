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

// Must stay the first import: see env-bridge.ts.
import '../env-bridge.ts'

/**
 * We need to put `DevChat` at the beginning of this file for import
 * because we have circular dependencies between `Puppet` & `DevChat`
 */
export type {
  DevChatOptions,
  DevChatInterface as DevChat,
}                               from '../devchat/mod.ts'
export {
  DevChatBuilder,
  type BuilderInterface,
}                               from '../devchat-builder.ts'

export {
  envSetting,
}                               from '../config.ts'

/** Setup wizard, multi-messenger runner and messenger registry. */
export {
  startDevChat,
  type StartDevChatOptions,
}                               from '../setup/runner.ts'
export {
  runInit,
  type InitOptions,
}                               from '../setup/init.ts'
export {
  MESSENGERS,
  parseMessengerChoice,
  resolvePuppetAlias,
  type MessengerId,
  type MessengerInfo,
}                               from '../setup/messengers.ts'
export {
  readProjectConfig,
  writeProjectConfig,
  type DevChatProjectConfig,
}                               from '../setup/config-file.ts'

/** devChat built-in plugins: CommandRouter, AutoReply and RateLimiter. */
export *                        from '../plugins/mod.ts'
export * as plugins             from '../plugins/mod.ts'

export type {
  SayableSayer,
  Sayable,
}                       from '../sayable/mod.ts'

export * as types       from 'wechaty-puppet/types'
export * as payloads    from 'wechaty-puppet/payloads'

export *                from './users.ts'
export * as users       from './users.ts'
export * as impls       from './impls.ts'
export * as helpers     from './helpers.ts'
export {
  ScanStatus,
}                       from 'wechaty-puppet/types'

export {
  log,
  config,
  qrcodeValueToImageUrl,
  VERSION,
}                         from '../config.ts'

export type {
  DevChatEventName,
}                             from '../schemas/mod.ts'

export type {
  OfficialPuppetNpmName,
  PuppetModuleName, // DEPRECATED
}                             from '../puppet-config.ts'
export type {
  DevChatPlugin,
  DevChatPluginUninstaller,
}                             from '../plugin.ts'
export type {
  IoClientOptions,
}                             from '../io-client.ts'
export {
  IoClient,
}                             from '../io-client.ts'
