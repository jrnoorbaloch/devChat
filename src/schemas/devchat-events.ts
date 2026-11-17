import { EventEmitter }         from 'events'
import type * as TypedEventEmitter from 'typed-emitter'

import type { GError }  from 'gerror'
import * as PUPPET      from 'wechaty-puppet'

import type {
  FriendshipInterface,
  ContactSelfInterface,
  RoomInterface,
  RoomInvitationInterface,
  ContactInterface,
  MessageInterface,
  PostInterface,
}                       from '../user-modules/mod.ts'

const DEVCHAT_EVENT_DICT = {
  ...PUPPET.types.CHAT_EVENT_DICT,
  dong      : 'Should be emitted after we call `DevChat.ding()`',
  error     : "Will be emitted when there's an Error occurred.",
  heartbeat : 'Will be emitted periodically after the DevChat started. If not, means that the DevChat had died.',
  puppet    : 'Will be emitted when the puppet has been set.',
  ready     : 'All underlined data source are ready for use.',
  start     : 'Will be emitted after the DevChat had been started.',
  stop      : 'Will be emitted after the DevChat had been stopped.',
} as const

type DevChatEventName  = keyof typeof DEVCHAT_EVENT_DICT

/**
 * DevChat Event Listener Interfaces
 */
type DevChatEventListenerDong       = (data?: string)                                                                                   => void | Promise<void>
type DevChatEventListenerError      = (error: GError)                                                                     => void | Promise<void>
type DevChatEventListenerFriendship = (friendship: FriendshipInterface)                                                                 => void | Promise<void>
type DevChatEventListenerHeartbeat  = (data: any)                                                                                       => void | Promise<void>
type DevChatEventListenerLogin      = (user: ContactSelfInterface)                                                                      => void | Promise<void>
type DevChatEventListenerLogout     = (user: ContactSelfInterface, reason?: string)                                                     => void | Promise<void>
type DevChatEventListenerMessage    = (message: MessageInterface)                                                                       => void | Promise<void>
type DevChatEventListenerPost       = (post: PostInterface)                                                                       => void | Promise<void>
type DevChatEventListenerPuppet     = (puppet: PUPPET.impls.PuppetInterface)                                                             => void | Promise<void>
type DevChatEventListenerReady      = ()                                                                                                => void | Promise<void>
type DevChatEventListenerRoomInvite = (roomInvitation: RoomInvitationInterface)                                                         => void | Promise<void>
type DevChatEventListenerRoomJoin   = (room: RoomInterface, inviteeList: ContactInterface[], inviter: ContactInterface,  date?: Date)   => void | Promise<void>
type DevChatEventListenerRoomLeave  = (room: RoomInterface, leaverList: ContactInterface[],  remover?: ContactInterface, date?: Date)   => void | Promise<void>
type DevChatEventListenerRoomTopic  = (room: RoomInterface, newTopic: string, oldTopic: string, changer: ContactInterface, date?: Date) => void | Promise<void>
type DevChatEventListenerScan       = (qrcode: string, status: PUPPET.types.ScanStatus, data?: string)                                   => void | Promise<void>
type DevChatEventListenerStartStop  = ()                                                                                                => void | Promise<void>

/**
 * @desc       DevChat Class Event Type
 * @typedef    DevChatEventName
 * @property   {string}  error       - When the bot get error, there will be a DevChat error event fired.
 * @property   {string}  login       - After the bot login full successful, the event login will be emitted, with a Contact of current logged in user.
 * @property   {string}  logout      - Logout will be emitted when bot detected log out, with a Contact of the current login user.
 * @property   {string}  heartbeat   - Get heartbeat of the bot.
 * @property   {string}  friendship  - When someone sends you a friend request, there will be a DevChat friendship event fired.
 * @property   {string}  message     - Emit when there's a new message.
 * @property   {string}  ready       - Emit when all data has load completed, in wechaty-puppet-padchat, it means it has sync Contact and Room completed
 * @property   {string}  room-join   - Emit when anyone join any room.
 * @property   {string}  room-topic  - Get topic event, emitted when someone change room topic.
 * @property   {string}  room-leave  - Emit when anyone leave the room.<br>
 *                                   - If someone leaves the room by themselves, WeChat will not notice other people in the room, so the bot will never get the "leave" event.
 * @property   {string}  room-invite - Emit when there is a room invitation, see more in  {@link RoomInvitation}
 * @property   {string}  scan        - A scan event will be emitted when the bot needs to show you a QR Code for scanning. </br>
 *                                    It is recommend to install qrcode-terminal(run `npm install qrcode-terminal`) in order to show qrcode in the terminal.
 */

/**
 * @desc       DevChat Class Event Function
 * @typedef    DevChatEventFunction
 * @property   {Function} error           -(this: DevChat, error: Error) => void | Promise<void> callback function
 * @property   {Function} login           -(this: DevChat, user: ContactSelf)=> void
 * @property   {Function} logout          -(this: DevChat, user: ContactSelf) => void | Promise<void>
 * @property   {Function} scan            -(this: DevChat, url: string, code: number) => void | Promise<void> <br>
 * <ol>
 * <li>URL: {String} the QR code image URL</li>
 * <li>code: {Number} the scan status code. some known status of the code list here is:</li>
 * </ol>
 * <ul>
 * <li>0 initial_</li>
 * <li>200 login confirmed</li>
 * <li>201 scanned, wait for confirm</li>
 * <li>408 waits for scan</li>
 * </ul>
 * @property   {Function} heartbeat       -(this: DevChat, data: any) => void | Promise<void>
 * @property   {Function} friendship      -(this: DevChat, friendship: Friendship) => void | Promise<void>
 * @property   {Function} message         -(this: DevChat, message: Message) => void | Promise<void>
 * @property   {Function} ready           -(this: DevChat) => void | Promise<void>
 * @property   {Function} room-join       -(this: DevChat, room: Room, inviteeList: Contact[],  inviter: Contact) => void | Promise<void>
 * @property   {Function} room-topic      -(this: DevChat, room: Room, newTopic: string, oldTopic: string, changer: Contact) => void | Promise<void>
 * @property   {Function} room-leave      -(this: DevChat, room: Room, leaverList: Contact[]) => void | Promise<void>
 * @property   {Function} room-invite     -(this: DevChat, room: Room, roomInvitation: RoomInvitation) => void | Promise<void> <br>
 *                                        see more in  {@link RoomInvitation}
 */

/**
 * @listens DevChat
 * @param   {DevChatEventName}      event      - Emit DevChatEvent
 * @param   {DevChatEventFunction}  listener   - Depends on the DevChatEvent
 *
 * @return  {DevChat}                          - this for chaining,
 * see advanced {@link https://devchat-docs.vercel.app|chaining usage}
 *
 * @desc
 * When the bot get message, it will emit the following Event.
 *
 * You can do anything you want when in these events functions.
 * The main Event name as follows:
 * - **scan**: Emit when the bot needs to show you a QR Code for scanning. After scan the qrcode, you can login
 * - **login**: Emit when bot login full successful.
 * - **logout**: Emit when bot detected log out.
 * - **message**: Emit when there's a new message.
 *
 * see more in {@link DevChatEventName}
 *
 * @example <caption>Event:scan</caption>
 * // Scan Event will emit when the bot needs to show you a QR Code for scanning
 *
 * bot.on('scan', (url, status) => {
 *   console.log(`[${status}] Scan ${url} to login.` )
 * })
 *
 * @example <caption>Event:login </caption>
 * // Login Event will emit when bot login full successful.
 *
 * bot.on('login', (user) => {
 *   console.log(`user ${user} login`)
 * })
 *
 * @example <caption>Event:logout </caption>
 * // Logout Event will emit when bot detected log out.
 *
 * bot.on('logout', (user) => {
 *   console.log(`user ${user} logout`)
 * })
 *
 * @example <caption>Event:message </caption>
 * // Message Event will emit when there's a new message.
 *
 * devchat.on('message', (message) => {
 *   console.log(`message ${message} received`)
 * })
 *
 * @example <caption>Event:friendship </caption>
 * // Friendship Event will emit when got a new friend request, or friendship is confirmed.
 *
 * bot.on('friendship', (friendship) => {
 *   if(friendship.type() === Friendship.Type.Receive){ // 1. receive new friendship request from new contact
 *     const contact = friendship.contact()
 *     let result = await friendship.accept()
 *       if(result){
 *         console.log(`Request from ${contact.name()} is accept successfully!`)
 *       } else{
 *         console.log(`Request from ${contact.name()} failed to accept!`)
 *       }
 *  } else if (friendship.type() === Friendship.Type.Confirm) { // 2. confirm friendship
 *       console.log(`new friendship confirmed with ${contact.name()}`)
 *    }
 *  })
 *
 * @example <caption>Event:room-join </caption>
 * // room-join Event will emit when someone join the room.
 *
 * bot.on('room-join', (room, inviteeList, inviter) => {
 *   const nameList = inviteeList.map(c => c.name()).join(',')
 *   console.log(`Room ${room.topic()} got new member ${nameList}, invited by ${inviter}`)
 * })
 *
 * @example <caption>Event:room-leave </caption>
 * // room-leave Event will emit when someone leave the room.
 *
 * bot.on('room-leave', (room, leaverList) => {
 *   const nameList = leaverList.map(c => c.name()).join(',')
 *   console.log(`Room ${room.topic()} lost member ${nameList}`)
 * })
 *
 * @example <caption>Event:room-topic </caption>
 * // room-topic Event will emit when someone change the room's topic.
 *
 * bot.on('room-topic', (room, topic, oldTopic, changer) => {
 *   console.log(`Room ${room.topic()} topic changed from ${oldTopic} to ${topic} by ${changer.name()}`)
 * })
 *
 * @example <caption>Event:room-invite, RoomInvitation has been encapsulated as a RoomInvitation Class. </caption>
 * // room-invite Event will emit when there's an room invitation.
 *
 * bot.on('room-invite', async roomInvitation => {
 *   try {
 *     console.log(`received room-invite event.`)
 *     await roomInvitation.accept()
 *   } catch (e) {
 *     console.error(e)
 *   }
 * })
 *
 * @example <caption>Event:error </caption>
 * // error Event will emit when there's an error occurred.
 *
 * bot.on('error', (error) => {
 *   console.error(error)
 * })
 */
interface DevChatEventListeners {
  'room-invite' : DevChatEventListenerRoomInvite
  'room-join'   : DevChatEventListenerRoomJoin
  'room-leave'  : DevChatEventListenerRoomLeave
  'room-topic'  : DevChatEventListenerRoomTopic
  dong          : DevChatEventListenerDong
  error         : DevChatEventListenerError
  friendship    : DevChatEventListenerFriendship
  heartbeat     : DevChatEventListenerHeartbeat
  login         : DevChatEventListenerLogin
  logout        : DevChatEventListenerLogout
  message       : DevChatEventListenerMessage
  post          : DevChatEventListenerPost
  puppet        : DevChatEventListenerPuppet
  ready         : DevChatEventListenerReady
  scan          : DevChatEventListenerScan
  start         : DevChatEventListenerStartStop
  stop          : DevChatEventListenerStartStop
}

const DevChatEventEmitter = EventEmitter as any as new () => TypedEventEmitter.default<
  DevChatEventListeners
>

export type {
  DevChatEventName,
  DevChatEventListeners,

  DevChatEventListenerDong,
  DevChatEventListenerError,
  DevChatEventListenerFriendship,
  DevChatEventListenerHeartbeat,
  DevChatEventListenerLogin,
  DevChatEventListenerLogout,
  DevChatEventListenerMessage,
  DevChatEventListenerPost,
  DevChatEventListenerPuppet,
  DevChatEventListenerReady,
  DevChatEventListenerRoomInvite,
  DevChatEventListenerRoomJoin,
  DevChatEventListenerRoomLeave,
  DevChatEventListenerRoomTopic,
  DevChatEventListenerScan,
  DevChatEventListenerStartStop,
}
export {
  DevChatEventEmitter,
}
