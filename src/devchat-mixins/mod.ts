import type {
  ProtectedPropertyGErrorMixin,
  GErrorMixin,
}                                   from './gerror-mixin.ts'
import {
  gErrorMixin,
}                                   from './gerror-mixin.ts'

import type {
  ProtectedPropertyPluginMixin,
  PluginMixin,
}                                   from './plugin-mixin.ts'
import {
  pluginMixin,
}                                   from './plugin-mixin.ts'

import type {
  ProtectedPropertyPuppetMixin,
  PuppetMixin,
}                                   from './puppet-mixin.ts'
import {
  puppetMixin,
}                                   from './puppet-mixin.ts'

import type {
  ProtectedPropertyDevChatifyUserModuleMixin,
  DevChatifyUserModuleMixin,
}                                   from './devchatify-user-module-mixin.ts'
import {
  devchatifyUserModuleMixin,
}                                   from './devchatify-user-module-mixin.ts'

import type {
  ProtectedPropertyIoMixin,
  IoMixin,
}                                   from './io-mixin.ts'
import {
  ioMixin,
}                                   from './io-mixin.ts'

import type {
  ProtectedPropertyMiscMixin,
  MiscMixin,
}                                   from './misc-mixin.ts'
import {
  miscMixin,
}                                   from './misc-mixin.ts'

import type {
  ProtectedPropertyLoginMixin,
  LoginMixin,
}                                   from './login-mixin.ts'
import {
  loginMixin,
}                                   from './login-mixin.ts'

type DevChatMixinProtectedProperty =
  | ProtectedPropertyGErrorMixin
  | ProtectedPropertyIoMixin
  | ProtectedPropertyLoginMixin
  | ProtectedPropertyMiscMixin
  | ProtectedPropertyPluginMixin
  | ProtectedPropertyPuppetMixin
  | ProtectedPropertyDevChatifyUserModuleMixin

export type {
  GErrorMixin,
  IoMixin,
  LoginMixin,
  MiscMixin,
  PluginMixin,
  PuppetMixin,
  DevChatifyUserModuleMixin,
  DevChatMixinProtectedProperty,
}
export {
  gErrorMixin,
  ioMixin,
  loginMixin,
  miscMixin,
  pluginMixin,
  puppetMixin,
  devchatifyUserModuleMixin,
}
