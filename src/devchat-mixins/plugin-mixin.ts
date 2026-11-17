import { log }              from 'wechaty-puppet'

import type {
  DevChatPlugin,
  DevChatPluginUninstaller,
}                             from '../plugin.ts'
import {
  isDevChatPluginUninstaller,
}                             from '../plugin.ts'

import type {
  DevChatSkeleton,
}                       from '../devchat/mod.ts'

import type { GErrorMixin } from './gerror-mixin.ts'
import type { MiscMixin }   from './misc-mixin.ts'

interface Plugable {
  use (
    ...plugins: (
      | DevChatPlugin
      | DevChatPlugin[]
    )[]
  ): DevChatPluginUninstaller
}

const pluginMixin = <MixinBase extends typeof DevChatSkeleton & GErrorMixin & MiscMixin> (mixinBase: MixinBase) => {
  log.verbose('DevChatPluginMixin', 'pluginMixin(%s)', mixinBase.name)

  abstract class PluginMixin extends mixinBase implements Plugable {

    constructor (...args: any[]) {
      super(...args)
    }

    /**
     * @param   {DevChatPlugin[]} plugins      - The plugins you want to use
     *
     * @return  {DevChatInterface}                      - this for chaining,
     *
     * @desc
     * For devchat ecosystem, allow user to define a 3rd party plugin for the all devchat instances
     *
     * @example
     * // Report all chat message to my server.
     *
     * function DevChatReportPlugin(options: { url: string }) {
     *   return function (bot: DevChat) {
     *     bot.on('message', message => http.post(options.url, { data: message }))
     *   }
     * }
     *
     * bot.use(DevChatReportPlugin({ url: 'http://somewhere.to.report.your.data.com' }))
     */
    use (
      ...plugins: (
        DevChatPlugin | DevChatPlugin[]
      )[]
    ): DevChatPluginUninstaller {
      const pluginList = plugins.flat()
      log.verbose('DevChatPluginMixin', 'use() total %d plugins', pluginList.length)

      const uninstallerList: DevChatPluginUninstaller[] = []

      for (const plugin of pluginList) {
        log.verbose('DevChatPluginMixin', 'use() installing Plugin %s on DevChat %s ...', plugin.name, this.name())

        const uninstaller = plugin(this as any) // <- Huan(202110): TODO: remove any
        if (isDevChatPluginUninstaller(uninstaller)) {
          log.verbose('DevChatPluginMixin', 'use() saving uninstaller for Plugin %s on DevChat %s ...', plugin.name, this.name())
          uninstallerList.push(uninstaller)
        }
      }

      /**
       * Return the function to uninstall all plugins
       */
      return () => uninstallerList.forEach(uninstaller => {
        log.verbose('DevChatPluginMixin', 'use() uninstalling Plugin %s on DevChat %s ...', uninstaller.name, this.name())
        uninstaller()
        log.verbose('DevChatPluginMixin', 'use() uninstalling Plugin %s on DevChat %s ... done', uninstaller.name, this.name())
      })
    }

  }

  return PluginMixin
}

type PluginMixin = ReturnType<typeof pluginMixin>

type ProtectedPropertyPluginMixin = never

export {
  type Plugable,
  type PluginMixin,
  type ProtectedPropertyPluginMixin,
  pluginMixin,
}
