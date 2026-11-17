import type { EventEmitter }  from 'events'

import type { Constructor }           from 'clone-class'
import type {
  DevChatMixinProtectedProperty,
}                                     from '../devchat-mixins/mod.ts'
import type { DevChatEventListeners } from '../schemas/mod.ts'
import { validationMixin }            from '../user-mixins/mod.ts'

import type {
  DevChatSkeletonProtectedProperty,
}                                     from './devchat-skeleton.ts'
import {
  DevChatBase,
  type DevChatBaseProtectedProperty,
}                                     from './devchat-base.ts'

/**
 * Huan(202111): this is for solving the circyle dependency problem
 *
 *  Construct a `DevChatImpl` based the `DevChatImplBase` with `validationMixin`
 *
 */
class DevChatImplBase extends validationMixin(DevChatBase)<DevChatImplInterface>() {}
interface DevChatImplInterface extends DevChatImplBase {}

class DevChatImpl extends validationMixin(DevChatImplBase)<DevChatInterface>() {}

/**
 * ^ The above code will make a ready-to-use class: `DevChatImpl`
 *  without any cyclic dependency problem.
 */

type AllProtectedProperty =
  | Exclude<keyof EventEmitter, symbol>  // Huan(202110): remove all EventEmitter first, and added typed event emitter later: or will get error
  | DevChatMixinProtectedProperty
  | DevChatBaseProtectedProperty
  | DevChatSkeletonProtectedProperty
  | `_${string}`// remove all property from interface which is start with `_`

/**
 * Huan(202111):
 * `on`/`off`/`once` must use TypedEventEmitter<DevChatEventListeners> instead of DevChatImpl
 *    or will run into error: cyclic dependency?
 */
interface DevChatEventEmitter {
  on:   <E extends keyof DevChatEventListeners>(event: E, listener: DevChatEventListeners[E]) => DevChatInterface
  off:  <E extends keyof DevChatEventListeners>(event: E, listener: DevChatEventListeners[E]) => DevChatInterface
  once: <E extends keyof DevChatEventListeners>(event: E, listener: DevChatEventListeners[E]) => DevChatInterface
}

type DevChatInterface = Omit<DevChatImplInterface, AllProtectedProperty>
  & DevChatEventEmitter

type DevChatConstructor = Constructor<
  DevChatInterface,
  typeof DevChatImpl
>

export  {
  type DevChatInterface,
  type DevChatConstructor,
  type AllProtectedProperty,
  DevChatImpl,
}
