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

/**
 * We need to put `Wechaty` at the beginning of this file for import
 * because we have circular dependencies between `Puppet` & `Wechaty`
 */
export type {
  WechatyOptions,
  WechatyInterface as Wechaty,
}                               from '../wechaty/mod.ts'
export {
  WechatyBuilder,
  type BuilderInterface,
}                               from '../wechaty-builder.ts'

/**
 * devChat brand names.
 *
 * devChat is a fork of Wechaty and stays API-compatible with it, so the
 * `Wechaty*` names above keep working and the ecosystem of
 * `wechaty-puppet-*` providers and plugins can be used unchanged. New code
 * should prefer the `DevChat*` aliases below; they are the same values and
 * types, not wrappers.
 */
export {
  WechatyBuilder as DevChatBuilder,
}                               from '../wechaty-builder.ts'
export type {
  WechatyOptions as DevChatOptions,
  WechatyInterface as DevChat,
}                               from '../wechaty/mod.ts'
export type {
  WechatyPlugin as DevChatPlugin,
  WechatyPluginUninstaller as DevChatPluginUninstaller,
}                               from '../plugin.ts'
export {
  envSetting,
}                               from '../config.ts'

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
  WechatyEventName,
}                             from '../schemas/mod.ts'

export type {
  OfficialPuppetNpmName,
  PuppetModuleName, // DEPRECATED
}                             from '../puppet-config.ts'
export type {
  WechatyPlugin,
  WechatyPluginUninstaller,
}                             from '../plugin.ts'
export type {
  IoClientOptions,
}                             from '../io-client.ts'
export {
  IoClient,
}                             from '../io-client.ts'
