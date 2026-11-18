/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `startDevChat()` - run one bot per chosen messenger with shared logic.
 *
 * Why it exists: with "Both" selected in `devchat init`, the same bot code has
 * to run on WeChat and WhatsApp at once. This module builds one bot per
 * messenger, lets the caller install the same plugins/handlers on each, prints
 * login QR codes in the terminal, keeps one failing messenger from stopping
 * the others, keeps driver bugs from crashing the process, and shuts every
 * bot down cleanly on Ctrl+C.
 *
 * Boundaries: it decides WHICH messengers run (options > devchat.config.json
 * > DEVCHAT_MESSENGERS > WeChat) and wires lifecycle logging. What the bot
 * does is entirely the caller's `setup` callback.
 */
import { createRequire } from 'node:module'

import qrTerm from 'qrcode-terminal'
import * as PUPPET from 'wechaty-puppet'

import { DevChatBuilder }        from '../devchat-builder.ts'
import type { DevChatInterface } from '../devchat/mod.ts'
import { qrcodeValueToImageUrl } from '../config.ts'

import { chromeMissingHelp, findChrome } from './chrome.ts'
import { readProjectConfig }     from './config-file.ts'
import { isPackageInstalled }    from './init.ts'
import {
  MESSENGERS,
  parseMessengerChoice,
  type MessengerId,
}                                from './messengers.ts'

/** Options for {@link startDevChat}. */
export interface StartDevChatOptions {
  /** Messengers to run. Default: from `devchat.config.json`, then `DEVCHAT_MESSENGERS`, then WeChat. */
  messengers?: MessengerId[]
  /** Project directory holding `devchat.config.json`. Default `process.cwd()`. */
  cwd?: string
  /**
   * Install plugins and handlers on each bot. Called once per messenger,
   * before the bot starts. `label` is the human name, e.g. `WhatsApp`.
   */
  setup?: (bot: DevChatInterface, label: string, id: MessengerId) => void | Promise<void>
  /** Print login QR codes in the terminal. Default `true`. */
  showQrInTerminal?: boolean
  /** Stop all bots on SIGINT/SIGTERM. Default `true`. */
  handleSignals?: boolean
  /**
   * Keep running when a messenger driver rejects a promise nobody handles,
   * instead of letting Node.js exit. Default `true`. See
   * {@link installDriverErrorGuard}.
   */
  guardDriverErrors?: boolean
  /** Build the bot for a messenger; injectable for tests. */
  buildBot?: (id: MessengerId) => DevChatInterface
}

/** Pick which messengers to run (see {@link StartDevChatOptions.messengers}). */
export function chooseMessengers (
  options: Pick<StartDevChatOptions, 'messengers' | 'cwd'>,
  env: NodeJS.ProcessEnv = process.env,
): MessengerId[] {
  if (options.messengers?.length) {
    return options.messengers
  }
  const fromFile = readProjectConfig(options.cwd ?? process.cwd())?.messengers
  if (fromFile) {
    return fromFile
  }
  const fromEnv = env['DEVCHAT_MESSENGERS'] && parseMessengerChoice(env['DEVCHAT_MESSENGERS'])
  return fromEnv || [ 'wechat' ]
}

/**
 * Build a filter that lets a message through only if the same text was not
 * shown in the last `windowMs`. Drivers retry failed requests in a loop, and
 * printing the identical error every second hides everything else.
 *
 * @returns `true` when the message should be printed.
 */
export function createRepeatFilter (windowMs = 60_000, now: () => number = Date.now): (message: string) => boolean {
  const lastShown = new Map<string, number>()
  return message => {
    const t = now()
    const last = lastShown.get(message)
    if (last !== undefined && t - last < windowMs) {
      return false
    }
    lastShown.set(message, t)
    return true
  }
}

/** Readable one-line text for any rejection reason (Error, string, object). */
export function describeError (reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message || reason.name
  }
  if (typeof reason === 'object' && reason !== null) {
    const r = reason as { message?: unknown, name?: unknown }
    return String(r.message ?? r.name ?? JSON.stringify(reason))
  }
  return String(reason)
}

/**
 * Build the `unhandledRejection` listener used by {@link installDriverErrorGuard}.
 * Prints each distinct message at most once a minute; with `DEVCHAT_DEBUG`
 * set it also prints the full reason.
 */
export function createDriverErrorHandler (
  print: (line: string) => void = line => console.error(line),
  env: NodeJS.ProcessEnv = process.env,
): (reason: unknown) => void {
  const show = createRepeatFilter()
  return reason => {
    const message = describeError(reason)
    if (show(message)) {
      print(`⚠ A messenger driver reported an error and devChat kept running: ${message}`)
      if (env['DEVCHAT_DEBUG']) {
        print(String((reason as Error)?.stack ?? reason))
      }
    }
  }
}

/**
 * Stop messenger-driver bugs from killing the bot process.
 *
 * Why: drivers register `async` event handlers on their messenger client.
 * When one of them throws (for example the WhatsApp driver handling a group
 * update before its cache is ready, right after login), the rejection is
 * never caught and Node.js exits by default. For a long-running bot it is
 * better to log the problem and keep serving messages.
 *
 * Scope: only installed by {@link startDevChat}, the application runner,
 * never by the library itself, so embedding apps keep control of their own
 * process. Synchronous uncaught exceptions are not touched: continuing after
 * those is unsafe.
 *
 * @returns a function that removes the guard again.
 */
export function installDriverErrorGuard (
  handler: (reason: unknown) => void = createDriverErrorHandler(),
): () => void {
  process.on('unhandledRejection', handler)
  return () => { process.off('unhandledRejection', handler) }
}

/** Whether a puppet package can be loaded from the project or from devChat itself. */
function driverAvailable (pkg: string, cwd: string): boolean {
  if (isPackageInstalled(pkg, cwd)) {
    return true
  }
  try {
    createRequire(import.meta.url).resolve(`${pkg}/package.json`)
    return true
  } catch {
    return false
  }
}

/**
 * Start one devChat bot per messenger.
 *
 * Contract: resolves with the bots that started successfully. A messenger
 * whose driver is missing or whose `start()` fails is reported with a fix and
 * skipped; the others keep running. Rejects only when no bot could start.
 */
export async function startDevChat (options: StartDevChatOptions = {}): Promise<DevChatInterface[]> {
  const cwd        = options.cwd ?? process.cwd()
  const messengers = chooseMessengers(options)
  const showQr     = options.showQrInTerminal ?? true
  /** Browser found for WhatsApp; set below before the WhatsApp bot is built. */
  let chromePath: string | undefined
  const build      = options.buildBot ?? ((id: MessengerId) => DevChatBuilder.build({
    name: `devchat-${id}`,
    puppet: MESSENGERS[id].puppet as any,
    // The WhatsApp driver passes `puppeteerOptions.puppeteer` to
    // puppeteer.launch(); this is how it learns which browser to start.
    ...(id === 'whatsapp' && chromePath
      ? { puppetOptions: { puppeteerOptions: { puppeteer: { executablePath: chromePath } } } as any }
      : {}),
  }))

  const started: DevChatInterface[] = []
  const removeGuard = (options.guardDriverErrors ?? true) ? installDriverErrorGuard() : () => {}

  for (const id of messengers) {
    const info = MESSENGERS[id]
    if (!options.buildBot && !driverAvailable(info.puppet, cwd)) {
      console.error(`✖ [${info.label}] is not installed yet. Run:  npm run setup`)
      continue
    }

    // Check for a browser up front: without one the WhatsApp driver fails
    // asynchronously after start() resolves, so the bot would look "started".
    if (id === 'whatsapp' && !options.buildBot) {
      const chrome = findChrome({ cwd })
      if (!chrome) {
        console.error(`✖ [${info.label}] cannot start.`)
        chromeMissingHelp().forEach(line => console.error(line))
        continue
      }
      chromePath = chrome.path
      // Also export it: puppeteer reads this variable if the option is ever dropped.
      process.env['PUPPETEER_EXECUTABLE_PATH'] ??= chrome.path
      if (chrome.source === 'system') {
        console.info(`  [${info.label}] using browser: ${chrome.path}`)
      }
    }

    const bot = build(id)
    const showError = createRepeatFilter()
    bot
      .on('scan', (qrcode: string, status: PUPPET.types.ScanStatus) => {
        if (!showQr) return
        if (status === PUPPET.types.ScanStatus.Waiting || status === PUPPET.types.ScanStatus.Timeout) {
          console.info(`\n📱 [${info.label}] Scan this QR code to log in:`)
          qrTerm.generate(qrcode, { small: true })
          console.info(`   Or open it in a browser: ${qrcodeValueToImageUrl(qrcode)}\n`)
        }
      })
      .on('login',  user => console.info(`✅ [${info.label}] Logged in as ${user.name()}`))
      .on('logout', user => console.info(`👋 [${info.label}] ${user.name()} logged out`))
      .on('error',  error => {
        if (showError(error.message)) {
          console.error(`⚠ [${info.label}] ${error.message} (repeats are hidden for 1 minute)`)
        }
      })

    if (options.setup) {
      await options.setup(bot, info.label, id)
    }

    try {
      await bot.start()
      started.push(bot)
      console.info(`▶ [${info.label}] bot started`)
    } catch (error) {
      console.error(`✖ [${info.label}] could not start: ${(error as Error).message}`)
      if (id === 'whatsapp') {
        console.error('  WhatsApp needs Chrome. Rerun  npm run setup  or see the troubleshooting guide in the docs.')
      }
    }
  }

  if (started.length === 0) {
    removeGuard()
    throw new Error('No bot could start. Run  npm run setup  and try again.')
  }

  if (options.handleSignals ?? true) {
    const stopAll = async () => {
      console.info('\nStopping bots…')
      await Promise.allSettled(started.map(bot => bot.stop()))
      process.exit(0)
    }
    process.once('SIGINT', stopAll)
    process.once('SIGTERM', stopAll)
  }

  return started
}
