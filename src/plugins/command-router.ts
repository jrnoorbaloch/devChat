/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `CommandRouter` - slash-command plugin for devChat bots.
 *
 * Why it exists: almost every bot ends up hand-parsing `/command arg1 arg2`
 * inside one large `on('message')` handler. This module owns that parsing,
 * dispatch to named handlers, an auto-generated `/help`, per-user rate
 * limiting, and error isolation (a throwing handler never crashes the bot).
 *
 * Boundaries: it only reads `PluginMessage` methods and replies through
 * `message.say()`. It never touches puppets directly. `parseCommand()` is a
 * pure function and `createCommandHandler()` is bot-independent so both are
 * unit tested without starting a bot; `CommandRouter()` just wires the handler
 * to the bot's `message` event.
 */
import type { Sayable }        from '../sayable/mod.ts'
import type { WechatyPlugin }  from '../plugin.ts'
import type { WechatyInterface } from '../wechaty/mod.ts'

import { RateLimiter }         from './rate-limiter.ts'
import type {
  PerTalkerRateLimit,
  PluginMessage,
}                              from './types.ts'

/** Result of {@link parseCommand}. */
export interface ParsedCommand {
  /** Command name without the prefix, e.g. `weather` for `/weather lahore`. */
  command: string
  /** Arguments split on whitespace; double or single quotes group words. */
  args: string[]
  /** Everything after the command name, trimmed, unparsed. */
  rawArgs: string
}

/** Context passed to every command handler. */
export interface CommandContext extends ParsedCommand {
  /** The message that triggered the command. */
  message: PluginMessage
  /** The bot, when the router runs as a plugin; `undefined` in unit tests. */
  bot?: WechatyInterface
}

/**
 * A command handler. Returning a `Sayable` (for example a string) replies with
 * it; returning nothing means the handler replied itself or chose not to.
 */
export type CommandHandler = (ctx: CommandContext) => void | Sayable | Promise<void | Sayable>

/** Long form of a command, with help text and aliases. */
export interface CommandDefinition {
  handler: CommandHandler
  /** One-line description shown by `/help`. */
  description?: string
  /** Extra names that trigger the same handler, e.g. `['p']` for `ping`. */
  aliases?: string[]
}

/** Options for {@link CommandRouter} and {@link createCommandHandler}. */
export interface CommandRouterOptions {
  /** Commands keyed by name. Values are a handler or a {@link CommandDefinition}. */
  commands: Record<string, CommandHandler | CommandDefinition>
  /** Command prefix. Default `'/'`. Must not be empty. */
  prefix?: string
  /** Register a built-in `help` command listing all commands. Default `true`. */
  help?: boolean
  /** Match command names case-sensitively. Default `false`. */
  caseSensitive?: boolean
  /** Ignore messages sent by the bot itself. Default `true`. */
  ignoreSelf?: boolean
  /** In rooms, only react when the bot is @-mentioned. Default `false`. */
  requireMentionInRoom?: boolean
  /** Throttle commands per talker. Disabled when omitted. */
  rateLimit?: PerTalkerRateLimit
  /** Reply sent once a talker is throttled; `false` to stay silent. */
  rateLimitedReply?: string | false
  /**
   * Reply for unknown commands. A string is sent as-is with `{command}`
   * replaced; `false` (default) ignores unknown commands so the bot does not
   * answer every message that happens to start with the prefix.
   */
  unknownReply?: string | false
  /** Called when a handler throws. Default: log to `console.error`. */
  onError?: (error: unknown, ctx: CommandContext) => void
}

/**
 * Split a message into a command and its arguments.
 *
 * Contract: returns `undefined` when `text` does not start with `prefix`
 * (after trimming leading whitespace) or when nothing follows the prefix.
 * Quoted arguments (`"two words"` or `'two words'`) become a single arg with
 * the quotes removed; an unterminated quote runs to the end of the text.
 */
export function parseCommand (text: string, prefix = '/'): ParsedCommand | undefined {
  if (!prefix) {
    throw new RangeError('parseCommand: prefix must not be empty')
  }
  const trimmed = text.trimStart()
  if (!trimmed.startsWith(prefix)) {
    return undefined
  }
  const body  = trimmed.slice(prefix.length)
  const match = /^(\S+)\s*([\s\S]*)$/.exec(body)
  if (!match) {
    return undefined
  }
  const command = match[1] as string
  const rawArgs = (match[2] ?? '').trim()
  return { args: tokenize(rawArgs), command, rawArgs }
}

/** Shell-like whitespace tokenizer that honours single and double quotes. */
function tokenize (input: string): string[] {
  const args: string[] = []
  const re = /"([^"]*)"?|'([^']*)'?|(\S+)/g
  for (const m of input.matchAll(re)) {
    args.push(m[1] ?? m[2] ?? m[3] ?? '')
  }
  return args
}

/** Normalize the user's command map into name -> definition. */
function buildRegistry (
  options: CommandRouterOptions,
  normalize: (name: string) => string,
): Map<string, CommandDefinition & { name: string }> {
  const registry = new Map<string, CommandDefinition & { name: string }>()
  const prefix   = options.prefix ?? '/'

  const add = (name: string, def: CommandDefinition) => {
    const entry = { ...def, name }
    for (const key of [ name, ...(def.aliases ?? []) ]) {
      const k = normalize(key)
      if (registry.has(k)) {
        throw new Error(`CommandRouter: duplicate command or alias "${key}"`)
      }
      registry.set(k, entry)
    }
  }

  for (const [ name, value ] of Object.entries(options.commands)) {
    add(name, typeof value === 'function' ? { handler: value } : value)
  }

  // `help` is added last so a user-defined `help` wins and is not duplicated.
  if ((options.help ?? true) && !registry.has(normalize('help'))) {
    add('help', {
      description: 'List available commands',
      handler: () => {
        const seen  = new Set<string>()
        const lines = [ 'Available commands:' ]
        for (const def of registry.values()) {
          if (seen.has(def.name)) continue
          seen.add(def.name)
          const alias = def.aliases?.length ? ` (${def.aliases.map(a => prefix + a).join(', ')})` : ''
          lines.push(`${prefix}${def.name}${alias}${def.description ? ' - ' + def.description : ''}`)
        }
        return lines.join('\n')
      },
    })
  }
  return registry
}

/**
 * Build a bot-independent message handler.
 *
 * The returned function resolves to `true` when the message was consumed as
 * a command (including throttled and unknown-command replies) and `false`
 * when it was ignored, so callers can chain other handlers after it.
 *
 * @throws Error at construction time on duplicate names/aliases or an empty prefix.
 */
export function createCommandHandler (
  options: CommandRouterOptions,
): (message: PluginMessage, bot?: WechatyInterface) => Promise<boolean> {
  const prefix    = options.prefix ?? '/'
  if (!prefix) {
    throw new RangeError('CommandRouter: prefix must not be empty')
  }
  const normalize = options.caseSensitive ? (s: string) => s : (s: string) => s.toLowerCase()
  const registry  = buildRegistry(options, normalize)
  const limiter   = options.rateLimit ? new RateLimiter(options.rateLimit) : undefined
  const onError   = options.onError ?? ((error: unknown, ctx: CommandContext) => {
    console.error(`[devChat] command "${ctx.command}" failed:`, error)
  })

  return async (message, bot) => {
    if ((options.ignoreSelf ?? true) && message.self()) {
      return false
    }
    const parsed = parseCommand(message.text(), prefix)
    if (!parsed) {
      return false
    }
    if (options.requireMentionInRoom && message.room()) {
      const mentioned = message.mentionSelf ? await message.mentionSelf() : false
      if (!mentioned) {
        return false
      }
    }

    const ctx: CommandContext = { ...parsed, bot, message }
    const def = registry.get(normalize(parsed.command))

    if (!def) {
      if (options.unknownReply) {
        await message.say(options.unknownReply.replaceAll('{command}', parsed.command))
        return true
      }
      return false
    }

    // Throttle only real commands so typos and chatter don't burn quota.
    if (limiter && !limiter.tryAcquire(message.talker().id)) {
      const reply = options.rateLimitedReply ?? 'You are sending commands too fast. Please wait a moment.'
      if (reply) {
        await message.say(reply)
      }
      return true
    }

    try {
      const result = await def.handler(ctx)
      if (result !== undefined && result !== null && result !== '') {
        await message.say(result)
      }
    } catch (error) {
      // Never let a handler error propagate into the bot's event loop.
      onError(error, ctx)
    }
    return true
  }
}

/**
 * Create a devChat plugin that routes `/commands` to handlers.
 *
 * @example
 * ```ts
 * bot.use(CommandRouter({
 *   commands: {
 *     ping: () => 'pong',
 *     echo: { description: 'Repeat text', handler: ({ rawArgs }) => rawArgs },
 *   },
 *   rateLimit: { limit: 5, intervalMs: 60_000 },
 * }))
 * ```
 *
 * The returned uninstaller removes the `message` listener.
 */
export function CommandRouter (options: CommandRouterOptions): WechatyPlugin {
  const handle = createCommandHandler(options)
  return (bot: WechatyInterface) => {
    // `say()` itself can reject (network, puppet logout); catch here so a
    // failed reply never becomes an unhandled rejection that kills the process.
    const listener = (message: PluginMessage) => {
      handle(message, bot).catch(error => console.error('[devChat] CommandRouter reply failed:', error))
    }
    bot.on('message', listener)
    return () => { bot.off('message', listener) }
  }
}
