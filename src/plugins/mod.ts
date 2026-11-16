/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Public barrel for devChat's built-in plugins.
 *
 * Everything exported here is re-exported from the package root
 * (`import { CommandRouter } from 'devchat'`) and from `devchat/plugins`.
 * Add new built-in plugins here so both entry points stay in sync.
 */
export {
  CommandRouter,
  createCommandHandler,
  parseCommand,
  type CommandContext,
  type CommandDefinition,
  type CommandHandler,
  type CommandRouterOptions,
  type ParsedCommand,
}                           from './command-router.ts'
export {
  AutoReply,
  createAutoReplyHandler,
  matchRule,
  type AutoReplyOptions,
  type AutoReplyResponse,
  type AutoReplyRule,
}                           from './auto-reply.ts'
export {
  RateLimiter,
  type RateLimiterOptions,
}                           from './rate-limiter.ts'
export type {
  PerTalkerRateLimit,
  PluginMessage,
}                           from './types.ts'
