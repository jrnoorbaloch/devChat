/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `AutoReply` - keyword / pattern auto-responder plugin for devChat bots.
 *
 * Why it exists: FAQ bots, greeters and support bots mostly map "message
 * looks like X" to "answer Y". This module owns that rule matching, the
 * room/mention policy, and per-talker throttling so bot authors can declare
 * rules as data instead of writing if/else chains.
 *
 * Boundaries: like `CommandRouter`, it only uses `PluginMessage` and replies
 * through `message.say()`. `createAutoReplyHandler()` is bot-independent for
 * unit tests; `AutoReply()` wires it to the bot's `message` event.
 */
import type { Sayable }          from '../sayable/mod.ts'
import type { WechatyPlugin }    from '../plugin.ts'
import type { WechatyInterface } from '../wechaty/mod.ts'

import { RateLimiter }           from './rate-limiter.ts'
import type {
  PerTalkerRateLimit,
  PluginMessage,
}                                from './types.ts'

/** Value or function producing the reply for a matched rule. */
export type AutoReplyResponse =
  | Sayable
  | ((message: PluginMessage, match: RegExpExecArray | null) => void | Sayable | Promise<void | Sayable>)

/** One auto-reply rule. */
export interface AutoReplyRule {
  /**
   * When the rule fires:
   * - `string`: case-insensitive match of the whole trimmed text
   *   (or a substring match when `contains` is `true`);
   * - `RegExp`: `regex.exec(text)` succeeds; the match is passed to `reply`;
   * - function: returns (or resolves to) `true`.
   */
  match: string | RegExp | ((text: string, message: PluginMessage) => boolean | Promise<boolean>)
  /** What to answer. Functions may return nothing to stay silent. */
  reply: AutoReplyResponse
  /** For string matchers: match anywhere in the text. Default `false`. */
  contains?: boolean
}

/** Options for {@link AutoReply} and {@link createAutoReplyHandler}. */
export interface AutoReplyOptions {
  /** Rules, checked in order. */
  rules: AutoReplyRule[]
  /** Ignore messages sent by the bot itself. Default `true`. */
  ignoreSelf?: boolean
  /** Answer in rooms (group chats). Default `true`. */
  rooms?: boolean
  /** In rooms, only answer when the bot is @-mentioned. Default `false`. */
  requireMentionInRoom?: boolean
  /** Stop after the first matching rule. Default `true`. */
  firstMatchOnly?: boolean
  /** Throttle replies per talker. Disabled when omitted. */
  rateLimit?: PerTalkerRateLimit
}

/**
 * Test one rule against a text.
 *
 * @returns `false` when the rule does not match; otherwise the `RegExp`
 *          match (for regex rules) or `null` (for string/function rules).
 */
export async function matchRule (
  rule: AutoReplyRule,
  text: string,
  message: PluginMessage,
): Promise<false | RegExpExecArray | null> {
  const { match } = rule
  if (typeof match === 'string') {
    const needle   = match.trim().toLowerCase()
    const haystack = text.trim().toLowerCase()
    const ok = rule.contains ? haystack.includes(needle) : haystack === needle
    return ok ? null : false
  }
  if (match instanceof RegExp) {
    // Reset lastIndex so global/sticky regexes behave the same on every message.
    match.lastIndex = 0
    return match.exec(text) ?? false
  }
  return (await match(text, message)) ? null : false
}

/**
 * Build a bot-independent auto-reply handler.
 *
 * Resolves to the number of replies sent (0 when nothing matched, the
 * message was filtered out, or the talker was throttled).
 */
export function createAutoReplyHandler (
  options: AutoReplyOptions,
): (message: PluginMessage) => Promise<number> {
  const limiter = options.rateLimit ? new RateLimiter(options.rateLimit) : undefined

  return async message => {
    if ((options.ignoreSelf ?? true) && message.self()) return 0
    const text = message.text()
    if (!text) return 0

    const room = message.room()
    if (room) {
      if (options.rooms === false) return 0
      if (options.requireMentionInRoom) {
        const mentioned = message.mentionSelf ? await message.mentionSelf() : false
        if (!mentioned) return 0
      }
    }

    let sent = 0
    for (const rule of options.rules) {
      const result = await matchRule(rule, text, message)
      if (result === false) continue

      // Check quota only once something matched, so ordinary chatter is free.
      if (sent === 0 && limiter && !limiter.tryAcquire(message.talker().id)) {
        return 0
      }

      const reply = typeof rule.reply === 'function'
        ? await (rule.reply as Exclude<AutoReplyResponse, Sayable>)(message, result)
        : rule.reply
      if (reply !== undefined && reply !== null && reply !== '') {
        await message.say(reply)
        sent++
      }
      if (options.firstMatchOnly ?? true) break
    }
    return sent
  }
}

/**
 * Create a devChat plugin that answers messages matching declarative rules.
 *
 * @example
 * ```ts
 * bot.use(AutoReply({
 *   rules: [
 *     { match: 'hi', reply: 'Hello! Type /help to see what I can do.' },
 *     { match: /price of (\w+)/i, reply: (_msg, m) => `Checking price of ${m?.[1]}...` },
 *   ],
 *   requireMentionInRoom: true,
 * }))
 * ```
 */
export function AutoReply (options: AutoReplyOptions): WechatyPlugin {
  const handle = createAutoReplyHandler(options)
  return (bot: WechatyInterface) => {
    const listener = (message: PluginMessage) => {
      handle(message).catch(error => console.error('[devChat] AutoReply failed:', error))
    }
    bot.on('message', listener)
    return () => { bot.off('message', listener) }
  }
}
