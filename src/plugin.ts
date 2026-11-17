import type { DevChatInterface } from './devchat/mod.ts'

export type DevChatPluginUninstaller = () => void

export type DevChatPluginReturn = void | DevChatPluginUninstaller

export interface DevChatPlugin {
  (bot: DevChatInterface): DevChatPluginReturn
}

function isDevChatPluginUninstaller (
  pluginReturn: DevChatPluginReturn,
): pluginReturn is DevChatPluginUninstaller {
  return typeof pluginReturn === 'function'
}

export {
  isDevChatPluginUninstaller,
}
