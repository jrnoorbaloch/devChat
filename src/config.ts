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
/// <reference path="./io-peer/json-rpc-peer.d.ts" />

import {
  log,
}                   from 'wechaty-puppet'
import { FileBox } from 'file-box'
import type {
  FileBoxInterface,
}                   from 'file-box'
import {
  type OfficialPuppetNpmName,
  OFFICIAL_PUPPET_DEFAULT,
}                      from './puppet-config.ts'
import {
  packageJson,
  GIT_COMMIT_HASH,
}                       from './package-json.ts'

type PackageJsonWechaty = {
  version?: string
  wechaty: {
    DEFAULT_PORT: number
    DEFAULT_PROTOCOL: string
    DEFAULT_APIHOST: string
  }
}

const VERSION = packageJson.version || '0.0.0'

/**
 * to handle unhandled exceptions
 */
if (log.level() === 'verbose' || log.level() === 'silly') {
  log.info('Config', 'registering process.on("unhandledRejection") for development/debug')

  /**
   * Refer to https://nodejs.org/api/process.html#process_event_unhandledrejection
   * the reason is in type: Error | any
   */
  process.on('unhandledRejection', (reason: Error | any, promise) => {
    log.error('Config', '###########################')
    log.error('Config', 'Wechaty unhandledRejection: %s %s', reason.stack || reason, promise)
    log.error('Config', '###########################')
    promise.catch(err => {
      log.error('Config', 'process.on(unhandledRejection) promise.catch(%s)', err.message)
      console.error('Config', err) // I don't know if log.error has similar full trace print support like console.error
    })
  })

  process.on('uncaughtException', function (error) {
    const origin = arguments[1] // to compatible with node 12 or below version typings

    log.error('Config', '###########################')
    log.error('Config', 'Wechaty uncaughtException: %s %s', error.stack, origin)
    log.error('Config', '###########################')
  })
}

export interface DefaultSetting {
  DEFAULT_PORT     : number,
  DEFAULT_APIHOST  : string,
  DEFAULT_PROTOCOL : string,
}

const DEFAULT_SETTING = packageJson['wechaty'] as DefaultSetting

/**
 * Read a devChat setting from the environment.
 *
 * devChat is a fork of Wechaty, so every setting can be provided either with
 * the new `DEVCHAT_` prefix or with the legacy `WECHATY_` prefix. The
 * `DEVCHAT_` variable always wins when both are set, which lets existing
 * Wechaty deployments migrate one variable at a time.
 *
 * @param key - setting name without prefix, e.g. `PUPPET` or `TOKEN`.
 * @param env - environment to read from; defaults to `process.env` and is
 *              injectable so the precedence rule can be unit tested.
 * @returns the first non-empty value, or `undefined` when neither is set.
 */
export function envSetting (
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env[`DEVCHAT_${key}`] || env[`WECHATY_${key}`] || undefined
}

export class Config {

  default = DEFAULT_SETTING

  apihost = envSetting('APIHOST') || DEFAULT_SETTING['DEFAULT_APIHOST']

  serviceIp = envSetting('PUPPET_SERVICE_IP') || ''

  systemPuppetName (): OfficialPuppetNpmName {
    return (
      envSetting('PUPPET') || OFFICIAL_PUPPET_DEFAULT
    ).toLowerCase() as OfficialPuppetNpmName
  }

  name = envSetting('NAME')

  // DO NOT set DEFAULT, because sometimes user do not want to connect to io cloud service
  token   = envSetting('TOKEN')

  debug   = !!(envSetting('DEBUG'))

  httpPort = process.env['PORT']
    || envSetting('PORT')
    || DEFAULT_SETTING['DEFAULT_PORT']

  docker = !!(envSetting('DOCKER'))

  constructor () {
    log.verbose('Config', 'constructor()')
    this.validApiHost(this.apihost)
  }

  validApiHost (apihost: string): boolean {
    if (/^[a-zA-Z0-9.\-_]+:?[0-9]*$/.test(apihost)) {
      return true
    }
    throw new Error('validApiHost() fail for ' + apihost)
  }

}

export const CHATIE_OFFICIAL_ACCOUNT_ID = 'gh_051c89260e5d'

export function qrCodeForChatie (): FileBoxInterface {
  const CHATIE_OFFICIAL_ACCOUNT_QRCODE = 'http://weixin.qq.com/r/qymXj7DEO_1ErfTs93y5'
  return FileBox.fromQRCode(CHATIE_OFFICIAL_ACCOUNT_QRCODE)
}

// http://jkorpela.fi/chars/spaces.html
// String.fromCharCode(8197)
export const FOUR_PER_EM_SPACE = String.fromCharCode(0x2005)
// mobile: \u2005, PC、mac: \u0020
export const AT_SEPARATOR_REGEX = /[\u2005\u0020]/

export function qrcodeValueToImageUrl (qrcodeValue: string): string {
  return [
    'https://wechaty.js.org/qrcode/',
    encodeURIComponent(qrcodeValue),
  ].join('')
}

export function isProduction (): boolean {
  return process.env['NODE_ENV'] === 'production'
      || process.env['NODE_ENV'] === 'prod'
}

const config = new Config()

export type {
  PackageJsonWechaty,
}
export {
  log,
  config,
  GIT_COMMIT_HASH,
  VERSION,
}
