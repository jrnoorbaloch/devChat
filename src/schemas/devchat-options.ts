import type * as PUPPET from 'wechaty-puppet'
import type {
  MemoryCard,
}                       from 'memory-card'

import type {
  OfficialPuppetNpmName,
}                             from '../puppet-config.ts'

interface OptionsPuppetInstance {
  puppet?: PUPPET.impls.PuppetInterface,
}

interface OptionsPuppetName {
  puppet?        : OfficialPuppetNpmName
  puppetOptions? : PUPPET.PuppetOptions
}

interface DevChatOptionsBase {
  memory?        : MemoryCard,
  name?          : string,
  ioToken?       : string,
}

type DevChatOptionsPuppetInstance =
  & DevChatOptionsBase
  & OptionsPuppetInstance

type DevChatOptionsPuppetName =
  & DevChatOptionsBase
  & OptionsPuppetName

type DevChatOptions =
  | DevChatOptionsPuppetInstance
  | DevChatOptionsPuppetName

export {
  type DevChatOptions,
  type DevChatOptionsPuppetName,
}
