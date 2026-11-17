import { log }              from 'wechaty-puppet'
import type { Constructor } from 'clone-class'

import type { DevChatInterface } from '../devchat/mod.ts'

const WECHATIFIED_PREFIX = 'Wechatified'

interface DevChatMinxin {
  devchat: DevChatInterface,
  new (...args: any[]): {
    get devchat (): DevChatInterface
  }
}

const devchatifyUserModule = <T extends DevChatMinxin> (UserClass: T) => {
  log.verbose('DevChatifyMixin', 'devchatifyUserModule(%s)', UserClass.name)

  return (devchat: DevChatInterface): T => {
    log.verbose('DevChatifyMixin', 'devchatifyUserModule(%s)(%s)', UserClass.name, devchat)

    class WechatifiedUserClass extends UserClass {

      static override get devchat () { return devchat }
      override get devchat        () { return devchat }

    }

    Reflect.defineProperty(WechatifiedUserClass, 'name', {
      value: WECHATIFIED_PREFIX + UserClass.name,
    })

    return WechatifiedUserClass
  }
}

const throwDevChatifyError = (DevChatUserClass: Function) => {
  throw new Error([
    `${DevChatUserClass.name}: DevChat User Class (WUC) can not be instantiated directly!`,
    'See: upstream issue #1217',
  ].join('\n'))
}

const isWechatified = (klass: Function) => klass.name.startsWith(WECHATIFIED_PREFIX)

const devchatifyMixin = <TBase extends Constructor> (Base: TBase) => {
  log.verbose('DevChatifyMixin', 'devchatifyMixin(%s)', Base.name || '')

  abstract class AbstractDevChatifyMixin extends Base {

    static get devchat  (): DevChatInterface { return throwDevChatifyError(this) }
    get devchat         (): DevChatInterface { return throwDevChatifyError(this.constructor) }

    constructor (...args: any[]) {
      super(...args)
      if (!isWechatified(this.constructor)) {
        throwDevChatifyError(this.constructor)
      }
    }

  }

  return AbstractDevChatifyMixin
}

const devchatifyMixinBase = () => devchatifyMixin(class EmptyBase {})

export {
  isWechatified,
  devchatifyMixin,
  devchatifyMixinBase,
  devchatifyUserModule,
}
