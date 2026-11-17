import { log }          from 'wechaty-puppet'

import {
  ContactImpl,
  ContactSelfImpl,
  DelayImpl,
  FriendshipImpl,
  ImageImpl,
  LocationImpl,
  MessageImpl,
  MiniProgramImpl,
  PostImpl,
  RoomImpl,
  RoomInvitationImpl,
  TagImpl,
  UrlLinkImpl,

  type ContactConstructor,
  type ContactSelfConstructor,
  type DelayConstructor,
  type FriendshipConstructor,
  type ImageConstructor,
  type LocationConstructor,
  type MessageConstructor,
  type MiniProgramConstructor,
  type PostConstructor,
  type RoomConstructor,
  type RoomInvitationConstructor,
  type TagConstructor,
  type UrlLinkConstructor,
  devchatifyUserModule,
}                       from '../user-modules/mod.ts'

import type {
  DevChatSkeleton,
}                             from '../devchat/mod.ts'

const devchatifyUserModuleMixin = <MixinBase extends typeof DevChatSkeleton> (mixinBase: MixinBase) => {
  log.verbose('DevChatifyUserModuleMixin', 'devchatifyUserModuleMixin(%s)', mixinBase.name)

  abstract class DevChatifyUserModuleMixin extends mixinBase {

    constructor (...args: any[]) {
      log.verbose('DevChatifyUserModuleMixin', 'constructor()')
      super(...args)
    }

    __wechatifiedContact?        : ContactConstructor
    __wechatifiedContactSelf?    : ContactSelfConstructor
    __wechatifiedDelay?          : DelayConstructor
    __wechatifiedFriendship?     : FriendshipConstructor
    __wechatifiedImage?          : ImageConstructor
    __wechatifiedLocation?       : LocationConstructor
    __wechatifiedMessage?        : MessageConstructor
    __wechatifiedMiniProgram?    : MiniProgramConstructor
    __wechatifiedPost?           : PostConstructor
    __wechatifiedRoom?           : RoomConstructor
    __wechatifiedRoomInvitation? : RoomInvitationConstructor
    __wechatifiedTag?            : TagConstructor
    __wechatifiedUrlLink?        : UrlLinkConstructor

    get Contact ()        : ContactConstructor        { return guardDevChatify(this.__wechatifiedContact)        }
    get ContactSelf ()    : ContactSelfConstructor    { return guardDevChatify(this.__wechatifiedContactSelf)    }
    get Delay ()          : DelayConstructor          { return guardDevChatify(this.__wechatifiedDelay)          }
    get Friendship ()     : FriendshipConstructor     { return guardDevChatify(this.__wechatifiedFriendship)     }
    get Image ()          : ImageConstructor          { return guardDevChatify(this.__wechatifiedImage)          }
    get Location ()       : LocationConstructor       { return guardDevChatify(this.__wechatifiedLocation)       }
    get Message ()        : MessageConstructor        { return guardDevChatify(this.__wechatifiedMessage)        }
    get MiniProgram ()    : MiniProgramConstructor    { return guardDevChatify(this.__wechatifiedMiniProgram)    }
    get Post ()           : PostConstructor           { return guardDevChatify(this.__wechatifiedPost)           }
    get Room ()           : RoomConstructor           { return guardDevChatify(this.__wechatifiedRoom)           }
    get RoomInvitation () : RoomInvitationConstructor { return guardDevChatify(this.__wechatifiedRoomInvitation) }
    get Tag ()            : TagConstructor            { return guardDevChatify(this.__wechatifiedTag)            }
    get UrlLink ()        : UrlLinkConstructor        { return guardDevChatify(this.__wechatifiedUrlLink)        }

    override async init (): Promise<void> {
      log.verbose('DevChatifyUserModuleMixin', 'init()')
      await super.init()

      /**
       * Skip if already wechatified
       */
      if (this.__wechatifiedMessage) {
        log.verbose('DevChatifyUserModuleMixin', 'init() DevChat User Module (WUM)s have already wechatified: skip')
        return
      }

      log.verbose('DevChatifyUserModuleMixin', 'init() initializing DevChat User Module (WUM) ...')

      /**
       * DevChatify User Classes
       *  1. Binding the devchat instance to the class
       *
       * Huan(202110): FIXME: remove any
       */
      this.__wechatifiedContact        = devchatifyUserModule(ContactImpl)(this as any)
      this.__wechatifiedContactSelf    = devchatifyUserModule(ContactSelfImpl)(this as any)
      this.__wechatifiedDelay          = devchatifyUserModule(DelayImpl)(this as any)
      this.__wechatifiedFriendship     = devchatifyUserModule(FriendshipImpl)(this as any)
      this.__wechatifiedImage          = devchatifyUserModule(ImageImpl)(this as any)
      this.__wechatifiedLocation       = devchatifyUserModule(LocationImpl)(this as any)
      this.__wechatifiedMessage        = devchatifyUserModule(MessageImpl)(this as any)
      this.__wechatifiedMiniProgram    = devchatifyUserModule(MiniProgramImpl)(this as any)
      this.__wechatifiedPost           = devchatifyUserModule(PostImpl)(this as any)
      this.__wechatifiedRoom           = devchatifyUserModule(RoomImpl)(this as any)
      this.__wechatifiedRoomInvitation = devchatifyUserModule(RoomInvitationImpl)(this as any)
      this.__wechatifiedTag            = devchatifyUserModule(TagImpl)(this as any)
      this.__wechatifiedUrlLink        = devchatifyUserModule(UrlLinkImpl)(this as any)

      log.verbose('DevChatifyUserModuleMixin', 'init() initializing DevChat User Module (WUM) ... done')
    }

  }

  return DevChatifyUserModuleMixin
}

/**
 * Huan(202008): we will bind the devchat puppet with user modules (Contact, Room, etc) together inside the start() method
 */
function guardDevChatify<T extends Function> (userModule?: T): T {
  if (userModule) {
    return userModule
  }
  throw new Error('DevChat User Module (WUM, for example: devchat.Room) can not be used before devchat.start()!')
}

type DevChatifyUserModuleMixin = ReturnType<typeof devchatifyUserModuleMixin>

type ProtectedPropertyDevChatifyUserModuleMixin =
  | '__wechatifiedContact'
  | '__wechatifiedContactSelf'
  | '__wechatifiedDelay'
  | '__wechatifiedFriendship'
  | '__wechatifiedImage'
  | '__wechatifiedLocation'
  | '__wechatifiedMessage'
  | '__wechatifiedMiniProgram'
  | '__wechatifiedRoom'
  | '__wechatifiedRoomInvitation'
  | '__wechatifiedTag'
  | '__wechatifiedUrlLink'

export type {
  DevChatifyUserModuleMixin,
  ProtectedPropertyDevChatifyUserModuleMixin,
}
export {
  devchatifyUserModuleMixin,
}
