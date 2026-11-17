/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `devchat init` - the setup wizard.
 *
 * Why it exists: getting a first bot running used to mean knowing driver
 * package names, installing them by hand and debugging install errors. The
 * wizard checks the environment, asks which messenger(s) to use (WeChat,
 * WhatsApp or both), installs only what that choice needs, writes
 * `devchat.config.json` and a starter `bot.ts`, and prints the next step.
 *
 * Design rules that future changes must keep:
 * - It is an explicit command, never an npm `postinstall` hook: install hooks
 *   cannot prompt reliably and break CI, Docker and `--ignore-scripts`.
 * - Every prompt has a flag / env equivalent (`--messenger`, `--yes`,
 *   `DEVCHAT_MESSENGERS`) so it also runs non-interactively.
 * - Failures end with a plain-language fix, not a stack trace.
 *
 * Boundaries: I/O (prompting, spawning npm, writing files) is injected via
 * {@link InitDeps} so the flow is unit tested without a terminal or network.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import spawn from 'cross-spawn'

import {
  MESSENGERS,
  parseMessengerChoice,
  type MessengerId,
}                               from './messengers.ts'
import {
  chromeMissingHelp,
  type ChromeLocation,
}                               from './chrome.ts'
import {
  CONFIG_FILE_NAME,
  readProjectConfig,
  writeProjectConfig,
}                               from './config-file.ts'

/** Options for {@link runInit}; mirrors the CLI flags. */
export interface InitOptions {
  /** Project directory. Default: `process.cwd()`. */
  cwd?: string
  /** Messenger answer, e.g. `"whatsapp"`, `"both"`, `"2"`. Skips the question. */
  messenger?: string
  /** Accept defaults without asking (WeChat, or the existing config). */
  yes?: boolean
  /** Do not run `npm install` (CI, offline, or when you install yourself). */
  skipInstall?: boolean
  /** Overwrite an existing starter `bot.ts`. Default `false`. */
  force?: boolean
}

/** Side-effecting operations, injectable for tests. */
export interface InitDeps {
  /** Ask a question and resolve with the raw answer. */
  prompt: (question: string) => Promise<string>
  /**
   * Install npm specs into `cwd`; resolve `true` on success. `save` is
   * `false` inside the devChat repository itself (see {@link runInit}).
   */
  install: (specs: string[], cwd: string, save: boolean) => Promise<boolean>
  /** Print one line for the user. */
  print: (line: string) => void
  /** Whether a human can answer prompts. */
  interactive: boolean
  /** Node.js version string, e.g. `26.1.0`. */
  nodeVersion: string
  /** Environment (for `DEVCHAT_MESSENGERS`). */
  env: NodeJS.ProcessEnv
  /** Locate a browser for WhatsApp (see `chrome.ts`). */
  findChrome: (cwd: string) => ChromeLocation | undefined
  /** Download puppeteer's Chrome build into the user cache; resolve `true` on success. */
  installChrome: (cwd: string) => Promise<boolean>
}

/** Outcome of {@link runInit}. `exitCode` 0 means ready to `npm start`. */
export interface InitResult {
  exitCode: number
  messengers?: MessengerId[]
  installed?: string[]
  createdFiles?: string[]
}

/** Minimum Node.js major version devChat runs on (matches `engines`). */
export const MIN_NODE_MAJOR = 26

/** Platform-specific instructions for installing a supported Node.js. */
export function nodeInstallHint (platform: NodeJS.Platform = process.platform): string {
  switch (platform) {
    case 'win32':
      return 'Install it with:  winget install OpenJS.NodeJS.LTS   (or download from https://nodejs.org), then open a NEW terminal.'
    case 'darwin':
      return 'Install it with:  brew install node   (or download from https://nodejs.org).'
    default:
      return 'Install it with nvm:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && nvm install --lts'
  }
}

/** `true` when `version` (e.g. `26.0.1` or `v26.0.1`) meets {@link MIN_NODE_MAJOR}. */
export function isSupportedNode (version: string): boolean {
  const major = Number(version.replace(/^v/, '').split('.')[0])
  return Number.isFinite(major) && major >= MIN_NODE_MAJOR
}

/**
 * Whether npm package `name` is installed for a project in `cwd`.
 * Walks up `node_modules` folders the same way Node.js resolution does.
 */
export function isPackageInstalled (name: string, cwd: string): boolean {
  let dir = cwd
  for (;;) {
    try {
      if (existsSync(join(dir, 'node_modules', name, 'package.json'))) {
        return true
      }
    } catch {
      // A folder we may not read (e.g. a sandboxed runtime) counts as "not here".
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return false
    }
    dir = parent
  }
}

/** Plain-language fixes printed when installing a driver fails. */
export function installFailureHelp (messengers: MessengerId[]): string[] {
  const lines = [
    'Installation did not finish. Common fixes:',
    '  1. Check your internet connection (and proxy / VPN settings), then run:  npm run setup',
    '  2. If npm reports a permissions error, do not use sudo; fix your npm folder or use nvm.',
  ]
  if (messengers.includes('whatsapp')) {
    lines.push(
      '  3. WhatsApp downloads Chrome. If that download is blocked, use an installed Chrome instead:',
      '       PUPPETEER_SKIP_DOWNLOAD=1 npm run setup',
      '       then set PUPPETEER_EXECUTABLE_PATH to your Chrome path before npm start.',
    )
  }
  lines.push(`Still stuck? Open an issue with the error above: https://github.com/jrnoorbaloch/devChat/issues`)
  return lines
}

/**
 * Starter bot source written to `bot.ts`.
 *
 * @param importFrom - module specifier for devChat: `'devchat'` in a user
 *        project, or `'./src/mods/mod.ts'` inside the devChat repository
 *        itself (where the published `dist/` entry does not exist yet).
 */
export function starterBotSource (importFrom: string): string {
  return `/**
 * Your devChat bot. Created by \`devchat init\`.
 *
 * Messengers to run are read from ${CONFIG_FILE_NAME}.
 * Change them any time with:  npm run setup
 * Start the bot with:         npm start
 */
import { AutoReply, CommandRouter, startDevChat } from '${importFrom}'

await startDevChat({
  setup: (bot, messenger) => {
    bot.use(
      CommandRouter({
        commands: {
          ping: { description: 'Check that the bot is alive', handler: () => 'pong' },
          echo: { description: 'Repeat your text', handler: ({ rawArgs }) => rawArgs || 'Usage: /echo <text>' },
          time: { description: 'Show the server time', handler: () => new Date().toUTCString() },
        },
        rateLimit: { limit: 10, intervalMs: 60_000 },
        requireMentionInRoom: true,
      }),
      AutoReply({
        rules: [
          { match: /^(hi|hello|salam)\\b/i, reply: 'Hello! 👋 Type /help to see what I can do.' },
        ],
        requireMentionInRoom: true,
      }),
    )

    bot.on('message', message => {
      console.info(\`[\${messenger}] \${message.talker().name()}: \${message.text()}\`)
    })
  },
})
`
}

/**
 * Whether `cwd` is a checkout of the devChat repository itself (the layout
 * the one-line installers create) rather than a user project that depends on
 * devChat.
 */
export function isDevChatRepo (cwd: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
    return pkg.name === 'devchat' && existsSync(join(cwd, 'src', 'mods', 'mod.ts'))
  } catch {
    // No or unreadable package.json: treat as a user project.
    return false
  }
}

/** Ask until the answer parses; empty answer selects `fallback`. */
async function askMessengers (deps: InitDeps, fallback: MessengerId[]): Promise<MessengerId[]> {
  const fallbackNo = fallback.length > 1 ? '3' : fallback[0] === 'whatsapp' ? '2' : '1'
  deps.print('Which messenger do you want your bot to use?')
  deps.print('  1) WeChat')
  deps.print('  2) WhatsApp')
  deps.print('  3) Both')
  for (let attempt = 0; attempt < 5; attempt++) {
    const answer = (await deps.prompt(`Enter 1, 2 or 3 [${fallbackNo}]: `)).trim()
    if (!answer) {
      return fallback
    }
    const parsed = parseMessengerChoice(answer)
    if (parsed) {
      return parsed
    }
    deps.print('Please type 1 (WeChat), 2 (WhatsApp) or 3 (Both).')
  }
  deps.print(`No valid answer; using ${fallback.map(m => MESSENGERS[m].label).join(' + ')}.`)
  return fallback
}

/**
 * Run the setup wizard.
 *
 * Steps: check Node.js -> choose messengers -> install missing drivers ->
 * make sure WhatsApp has a browser -> write `devchat.config.json` -> create `bot.ts` (unless it exists) -> print
 * next steps. Never throws for expected problems; returns a non-zero
 * `exitCode` after printing a fix instead.
 */
export async function runInit (options: InitOptions, deps: InitDeps): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd()
  const say = deps.print
  const inRepo = isDevChatRepo(cwd)

  say('')
  say('devChat setup')
  say('=============')

  if (!isSupportedNode(deps.nodeVersion)) {
    say(`devChat needs Node.js ${MIN_NODE_MAJOR} or newer. You have ${deps.nodeVersion}.`)
    say(nodeInstallHint())
    return { exitCode: 1 }
  }
  say(`✔ Node.js ${deps.nodeVersion}`)

  // 1. Choose messengers: flag > env > prompt > existing config > WeChat.
  let existing: MessengerId[] | undefined
  try {
    existing = readProjectConfig(cwd)?.messengers
  } catch (e) {
    say(`! ${(e as Error).message} It will be replaced.`)
  }
  const fallback: MessengerId[] = existing ?? [ 'wechat' ]
  const explicit = options.messenger ?? deps.env['DEVCHAT_MESSENGERS']

  let messengers: MessengerId[]
  if (explicit !== undefined) {
    const parsed = parseMessengerChoice(explicit)
    if (!parsed) {
      say(`Unknown messenger "${explicit}". Use wechat, whatsapp or both.`)
      return { exitCode: 1 }
    }
    messengers = parsed
  } else if (deps.interactive && !options.yes) {
    messengers = await askMessengers(deps, fallback)
  } else {
    messengers = fallback
  }
  say(`✔ Messenger: ${messengers.map(m => MESSENGERS[m].label).join(' + ')}`)
  for (const m of messengers) {
    for (const note of MESSENGERS[m].notes) {
      say(`  • ${MESSENGERS[m].label}: ${note}`)
    }
  }

  // 2. Install only the drivers this choice needs and that are missing.
  const missing = messengers
    .map(m => MESSENGERS[m])
    .filter(info => info.installSpec && !isPackageInstalled(info.puppet, cwd))
    .map(info => info.installSpec as string)

  if (missing.length === 0) {
    say('✔ Everything needed is already installed')
  } else if (options.skipInstall) {
    say(`! Skipped installing: ${missing.join(' ')}`)
    say(`  Install later with:  npm install ${missing.join(' ')}`)
  } else {
    say(`… Installing ${missing.join(' ')} (this can take a few minutes)`)
    // Inside the devChat checkout, do not edit the tracked package.json: a
    // local edit would make the installer's `git pull --ff-only` update fail.
    // If a later `npm install` prunes the driver, the runner says to rerun setup.
    const save = !inRepo
    let ok = await deps.install(missing, cwd, save)
    if (!ok) {
      say('… Retrying once')
      ok = await deps.install(missing, cwd, save)
    }
    if (!ok) {
      installFailureHelp(messengers).forEach(say)
      return { exitCode: 1, messengers }
    }
    say('✔ Installed')
  }

  // 3. WhatsApp needs a Chromium browser. Prefer one already on the computer;
  //    download puppeteer's Chrome only when none exists, because that
  //    download is the step most often blocked by networks and antivirus.
  if (messengers.includes('whatsapp')) {
    let chrome = deps.findChrome(cwd)
    if (!chrome && !options.skipInstall) {
      say('… No Chrome found for WhatsApp. Downloading it (about 150 MB)')
      if (await deps.installChrome(cwd)) {
        chrome = deps.findChrome(cwd)
      }
    }
    if (chrome) {
      say(`✔ Browser for WhatsApp: ${chrome.path}`)
    } else if (options.skipInstall) {
      say('! No Chrome found for WhatsApp yet. Install Google Chrome before npm start.')
    } else {
      chromeMissingHelp().forEach(say)
      return { exitCode: 1, messengers }
    }
  }

  // 4. Remember the choice and create a starter bot.
  const createdFiles = [ writeProjectConfig(cwd, { messengers }) ]
  say(`✔ Saved ${CONFIG_FILE_NAME}`)

  const botFile = join(cwd, 'bot.ts')
  if (!existsSync(botFile) || options.force) {
    writeFileSync(botFile, starterBotSource(inRepo ? './src/mods/mod.ts' : 'devchat'))
    createdFiles.push(botFile)
    say('✔ Created bot.ts (your bot code)')
  } else {
    say('✔ Kept your existing bot.ts')
  }

  say('')
  say('All set! Start your bot with:')
  say('')
  say('    npm start')
  say('')
  say('A QR code will appear. Scan it with the phone app of the account the bot should use:')
  for (const m of messengers) {
    say(m === 'whatsapp'
      ? '  • WhatsApp: Settings → Linked devices → Link a device'
      : '  • WeChat: tap + → Scan')
  }
  say('Then send /help to the bot from another account.')
  return { createdFiles, exitCode: 0, installed: missing, messengers }
}

/**
 * Default npm installer used by the CLI.
 *
 * Uses `cross-spawn` so `npm` resolves to `npm.cmd` on Windows. With `save`,
 * packages are recorded in the project's `package.json` so later
 * `npm install` runs keep them.
 */
export function npmInstall (specs: string[], cwd: string, save: boolean): Promise<boolean> {
  return new Promise(resolve => {
    const saveFlag = save ? '--save' : '--no-save'
    const child = spawn('npm', [ 'install', saveFlag, '--no-audit', '--no-fund', ...specs ], {
      cwd,
      stdio: 'inherit',
    })
    child.on('error', () => resolve(false))
    child.on('close', code => resolve(code === 0))
  })
}
