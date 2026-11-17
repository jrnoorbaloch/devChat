import * as PUPPET      from 'wechaty-puppet'
import { log }          from 'wechaty-puppet'
import {
  GError,
  timeoutPromise,
  TimeoutPromiseGError,
}                       from 'gerror'

import { StateSwitch }  from 'state-switch'
import type {
  StateSwitchInterface,
}                       from 'state-switch'

import { config }               from '../config.ts'
import { resolvePuppetAlias }   from '../setup/messengers.ts'
import type {
  ContactImpl,
  RoomImpl,
}                               from '../user-modules/mod.ts'

import { registerPuppetEventBridge } from './puppet-event-bridge.ts'

import type {
  DevChatifyUserModuleMixin,
}                               from './devchatify-user-module-mixin.ts'

import type { GErrorMixin } from './gerror-mixin.ts'
import type { IoMixin }     from './io-mixin.ts'

const PUPPET_MEMORY_NAME = 'puppet'

/**
 * Huan(202111): the `wechaty-redux` plugin need to be installed before
 *  the puppet started
 *
 * Plugins that subscribe to the `puppet` event must register their listeners
 *  before the first `init()` emits it. `pluginMixin` is composed outside
 *  `puppetMixin` and has no lifecycle hooks, so the mixin order does not
 *  affect this.
 *
 * Huan(20211128): `puppetMixin` must extend `IoMixin`
 *  because the Io need the puppet instance to be ready when it starts
 */
const puppetMixin = <MixinBase extends DevChatifyUserModuleMixin & GErrorMixin & IoMixin> (mixinBase: MixinBase) => {
  log.verbose('DevChatPuppetMixin', 'puppetMixin(%s)', mixinBase.name)

  abstract class PuppetMixin extends mixinBase {

    __puppet?: PUPPET.impls.PuppetInterface

    get puppet (): PUPPET.impls.PuppetInterface {
      if (!this.__puppet) {

        throw new Error('NOPUPPET')
      }
      return this.__puppet
    }

    readonly __readyState : StateSwitchInterface

    __puppetMixinInited = false

    constructor (...args: any[]) {
      log.verbose('DevChatPuppetMixin', 'construct()')
      super(...args)

      this.__readyState = new StateSwitch('DevChatReady', { log })
    }

    override async start (): Promise<void> {
      log.verbose('DevChatPuppetMixin', 'start()')

      log.verbose('DevChatPuppetMixin', 'start() super.start() ...')
      await super.start()
      log.verbose('DevChatPuppetMixin', 'start() super.start() ... done')

      try {
        /**
         * reset the `devchat.ready()` state
         *  if it was previous set to `active`
         */
        if (this.__readyState.active()) {
          this.__readyState.inactive(true)
        }

        try {
          log.verbose('DevChatPuppetMixin', 'start() starting puppet ...')
          await timeoutPromise(
            this.puppet.start(),
            15 * 1000,  // 15 seconds timeout
          )
          log.verbose('DevChatPuppetMixin', 'start() starting puppet ... done')
        } catch (e) {
          if (e instanceof TimeoutPromiseGError) {
            /**
             * Huan(202111):
             *
             *  We should throw the Timeout error when the puppet.start() can not be finished in time.
             *  However, we need to compatible with some buggy puppet implementations which will not resolve the promise.
             *
             * TODO: throw the Timeout error when the puppet.start() can not be finished in time.
             *
             * e.g. after resolve @issue https://github.com/padlocal/wechaty-puppet-padlocal/issues/116
             */
            log.warn('DevChatPuppetMixin', 'start() starting puppet ... timeout')
            log.warn('DevChatPuppetMixin', 'start() puppet info: %s', this.puppet)
          } else {
            throw e
          }
        }

      } catch (e) {
        /**
         * A failed puppet start must reject `start()` consistently,
         *  whether or not an `error` listener is registered.
         *
         * Re-throw so the outermost `serviceCtlMixin.start()` rejects consistently.
         * With a non-throwing `error` listener, it also runs `stop()` and leaves
         *  the state `inactive`. Without a listener, error emission interrupts
         *  cleanup and leaves the state `pending`.
         *
         * Previously this called `this.emitError(e)`, which swallowed the failure:
         *  with a listener the bot wrongly reported itself active, and without a
         *  listener the synchronous EventEmitter throw left the state `pending`.
         *
         * @see upstream issue #2855
         */
        throw GError.from(e)
      }
    }

    override async stop (): Promise<void> {
      log.verbose('DevChatPuppetMixin', 'stop()')

      try {
        log.verbose('DevChatPuppetMixin', 'stop() stopping puppet ...')
        await timeoutPromise(
          this.puppet.stop(),
          15 * 1000,  // 15 seconds timeout
        )
        log.verbose('DevChatPuppetMixin', 'stop() stopping puppet ... done')
      } catch (e) {
        if (e instanceof TimeoutPromiseGError) {
          log.warn('DevChatPuppetMixin', 'stop() stopping puppet ... timeout')
          log.warn('DevChatPuppetMixin', 'stop() puppet info: %s', this.puppet)
        }
        this.emitError(e)
      }

      log.verbose('DevChatPuppetMixin', 'stop() super.stop() ...')
      await super.stop()
      log.verbose('DevChatPuppetMixin', 'stop() super.stop() ... done')
    }

    async ready (): Promise<void> {
      log.verbose('DevChatPuppetMixin', 'ready()')
      await this.__readyState.stable('active')
      log.silly('DevChatPuppetMixin', 'ready() this.readyState.stable(on) resolved')
    }

    override async init (): Promise<void> {
      log.verbose('DevChatPuppetMixin', 'init()')
      await super.init()

      if (this.__puppetMixinInited) {
        log.verbose('DevChatPuppetMixin', 'init() skipped because this puppet has already been inited before.')
        return
      }
      this.__puppetMixinInited = true

      log.verbose('DevChatPuppetMixin', 'init() instanciating puppet instance ...')
      const puppetInstance = await PUPPET.helpers.resolvePuppet({
        // Friendly names such as 'whatsapp' map to their puppet package.
        puppet: typeof this.__options.puppet === 'string'
          ? resolvePuppetAlias(this.__options.puppet) as any
          : this.__options.puppet || config.systemPuppetName(),
        puppetOptions: 'puppetOptions' in this.__options
          ? this.__options.puppetOptions
          : undefined,
      })
      log.verbose('DevChatPuppetMixin', 'init() instanciating puppet instance ... done')

      /**
       * Plug the Memory Card to Puppet
       */
      log.verbose('DevChatPuppetMixin', 'init() setting memory ...')
      const puppetMemory = this.memory.multiplex(PUPPET_MEMORY_NAME)
      puppetInstance.setMemory(puppetMemory)
      log.verbose('DevChatPuppetMixin', 'init() setting memory ... done')

      /**
       * Propagate Puppet Events to DevChat
       */
      log.verbose('DevChatPuppetMixin', 'init() setting up events ...')
      this.__setupPuppetEvents(puppetInstance)
      log.verbose('DevChatPuppetMixin', 'init() setting up events ... done')

      /**
        * Private Event
        *   - Huan(202005): emit puppet when set
        *   - Huan(202110): @see https://devchat-docs.vercel.app
        */
      log.verbose('DevChatPuppetMixin', 'init() emitting "puppet" event ...')
      ;(this.emit as any)('puppet', puppetInstance)
      log.verbose('DevChatPuppetMixin', 'init() emitting "puppet" event ... done')

      this.__puppet = puppetInstance
    }

    __setupPuppetEvents (puppet: PUPPET.impls.PuppetInterface): void {
      log.verbose('DevChatPuppetMixin', '__setupPuppetEvents(%s)', puppet)

      registerPuppetEventBridge(puppet, {
        contactFind: id => this.Contact.find({ id }),
        contactReady: async id => {
          const contact = await this.Contact.find({ id }) as unknown as undefined | ContactImpl
          await contact?.ready(true)
        },
        contactSelfFind: id => this.ContactSelf.find({ id }),
        friendshipLoad: id => this.Friendship.load(id),
        messageFind: id => this.Message.find({ id }),
        postFind: id => this.Post.find({ id }),
        roomFind: id => this.Room.find({ id }),
        roomInvitationLoad: id => this.RoomInvitation.load(id),
        roomReady: async id => {
          const room = await this.Room.find({ id }) as unknown as undefined | RoomImpl
          await room?.ready(true)
        },
        setReady: state => {
          if (state === 'active') {
            this.__readyState.active(true)
          } else {
            this.__readyState.inactive(true)
          }
        },
        // Preserve GErrorMixin's error-event conversion for bridge emissions.
        emit: this.emit.bind(this),
        emitError: error => this.emitError(error),
      })
    }

  }

  return PuppetMixin
}

type PuppetMixin = ReturnType<typeof puppetMixin>

type ProtectedPropertyPuppetMixin =
  | '__puppet'
  | '__readyState'
  | '__setupPuppetEvents'

export type {
  PuppetMixin,
  ProtectedPropertyPuppetMixin,
}
export {
  puppetMixin,
}
