import { log }      from 'wechaty-puppet'

import type {
  ContactSelfImpl,
  ContactSelfInterface,
}                               from '../user-modules/mod.ts'
import type { DevChatSkeleton } from '../devchat/mod.ts'

import type { GErrorMixin }     from './gerror-mixin.ts'
import type { PuppetMixin }     from './puppet-mixin.ts'

const loginMixin = <MixinBase extends typeof DevChatSkeleton & PuppetMixin & GErrorMixin> (mixinBase: MixinBase) => {
  log.verbose('DevChatLoginMixin', 'loginMixin(%s)', mixinBase.name)

  abstract class LoginMixin extends mixinBase {

    get authQrCode (): undefined | string {
      return this.puppet.authQrCode
    }

    /**
     * The current user
     *
     * @returns {ContactSelfInterface}
     * @example
     * const contact = bot.currentUser
     * console.log(`Bot is ${contact.name()}`)
     */
    get currentUser (): ContactSelfInterface {
      return (this.ContactSelf as typeof ContactSelfImpl)
        .load(this.puppet.currentUserId)
    }

    /**
     * Get the logon / logoff state
     *
     * @returns {boolean}
     * @example
     * if (bot.isLoggedin) {
     *   console.log('Bot logged in')
     * } else {
     *   console.log('Bot not logged in')
     * }
     */
    get isLoggedIn (): boolean {
      try {
        // the `this.puppet` might not be initialized yet
        return this.puppet.isLoggedIn
      } catch (e) {
        this.emit('error', e)

        log.warn('DevChatLoginMixin', 'get isLoggedIn puppet instance is not ready yet')
        // upstream issue #1878
        return false
      }
    }

    __loginMixinInited = false

    constructor (...args: any[]) {
      log.verbose('DevChatLoginMixin', 'constructor()')
      super(...args)
    }

    override async init (): Promise<void> {
      log.verbose('DevChatLoginMixin', 'init()')
      await super.init()

      if (this.__loginMixinInited) {
        return
      }
      this.__loginMixinInited = true
    }

    /**
     * Logout the bot
     *
     * @returns {Promise<void>}
     * @example
     * await bot.logout()
     */
    async logout (): Promise<void>  {
      log.verbose('DevChatLoginMixin', 'logout()')
      await this.puppet.logout()
    }

    /**
     * @deprecated: use `isLoggedIn` property instead. will be removed after Dec 31, 2022
     */
    logonoff (): boolean {
      log.warn('DevChatLoginMixin', 'logonoff() is deprecated: use `isLoggedIn` property instead.\n%s', new Error().stack)
      return this.isLoggedIn
    }

    /**
     * Will be removed after Dec 31, 2022
     * @deprecated use {@link DevChat#currentUser} instead
     */
    userSelf () {
      log.warn('DevChatLoginMixin', 'userSelf() deprecated: use currentUser instead.\n%s',
        new Error().stack,
      )
      return this.currentUser
    }

  }

  return LoginMixin
}

type LoginMixin = ReturnType<typeof loginMixin>

type ProtectedPropertyLoginMixin =
  | 'userSelf'  // deprecated: use `currentUser` instead. (will be removed after Dec 31, 2022)
  | 'logonoff'  // deprecated: use `isLoggedIn` instead. ((will be removed after Dec 31, 2022)
  | '__loginMixinInited'

export type {
  LoginMixin,
  ProtectedPropertyLoginMixin,
}
export {
  loginMixin,
}
