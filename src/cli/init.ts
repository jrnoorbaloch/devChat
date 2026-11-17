/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `devchat init` CLI command: thin cmd-ts wrapper that turns flags into
 * {@link runInit} options and wires the real terminal, npm and environment.
 * All behaviour lives in `src/setup/init.ts`.
 */
import { createInterface } from 'node:readline/promises'

import {
  command,
  flag,
  option,
  optional,
  string,
}                 from 'cmd-ts'

import { npmInstall, runInit } from '../setup/init.ts'
import { findChrome, installBundledChrome } from '../setup/chrome.ts'

/**
 * Run the wizard against the real terminal.
 * Exported for `bin/init.ts`; returns the process exit code.
 */
export async function runInitCli (opts: { messenger?: string, yes?: boolean, skipInstall?: boolean, force?: boolean }): Promise<number> {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env['CI']
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined
  try {
    const result = await runInit(opts, {
      env: process.env,
      findChrome: cwd => findChrome({ cwd }),
      install: npmInstall,
      installChrome: installBundledChrome,
      interactive,
      nodeVersion: process.versions.node,
      print: line => console.info(line),
      prompt: q => rl ? rl.question(q) : Promise.resolve(''),
    })
    return result.exitCode
  } finally {
    rl?.close()
  }
}

const init = command({
  name: 'init',
  description: 'Set up devChat: choose WeChat, WhatsApp or both, install what is needed and create bot.ts',
  args: {
    messenger: option({
      type: optional(string),
      long: 'messenger',
      short: 'm',
      description: 'wechat | whatsapp | both (skips the question)',
    }),
    yes: flag({ long: 'yes', short: 'y', description: 'Accept defaults without asking' }),
    skipInstall: flag({ long: 'skip-install', description: 'Do not run npm install' }),
    force: flag({ long: 'force', description: 'Overwrite an existing bot.ts' }),
  },
  handler: async args => {
    process.exitCode = await runInitCli(args)
  },
})

export { init }
