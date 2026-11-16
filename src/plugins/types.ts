/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Shared types for the devChat built-in plugins.
 *
 * The plugins only need a handful of `Message` methods. Declaring that subset
 * structurally (instead of importing the full `MessageInterface`) keeps the
 * plugin logic decoupled from puppets and lets tests drive it with tiny fake
 * messages. A real devChat/Wechaty `Message` satisfies this interface as-is.
 */
import type { Sayable } from '../sayable/mod.ts'

/** The subset of a chat message that devChat plugins rely on. */
export interface PluginMessage {
  /** Plain text of the message; empty string for non-text messages. */
  text (): string
  /** `true` when the bot itself sent the message. */
  self (): boolean
  /** Who sent the message. Only `id` is required by the plugins. */
  talker (): { id: string }
  /** The room (group) the message was sent in, if any. */
  room (): undefined | { id: string }
  /** Reply in the same conversation (room or direct chat). */
  say (sayable: Sayable): Promise<unknown>
  /** Whether the bot was @-mentioned. Optional so fakes may omit it. */
  mentionSelf? (): Promise<boolean>
}

/** Rate limit applied per talker (sender id). */
export interface PerTalkerRateLimit {
  /** Maximum replies to one talker inside the window. */
  limit: number
  /** Window length in milliseconds. */
  intervalMs: number
}
