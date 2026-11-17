#!/usr/bin/env node
/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `npm run setup` / `devchat-init` entry point.
 *
 * Kept separate from the `devchat` multi-command CLI so the most common first
 * step needs no subcommand. Flags: --messenger/-m <wechat|whatsapp|both>,
 * --yes/-y, --skip-install, --force, --help/-h.
 */
import { parseArgs } from 'node:util'

import { runInitCli } from '../src/cli/init.ts'

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    force:          { type: 'boolean' },
    help:           { short: 'h', type: 'boolean' },
    messenger:      { short: 'm', type: 'string' },
    'skip-install': { type: 'boolean' },
    yes:            { short: 'y', type: 'boolean' },
  },
  strict: true,
})

if (values.help) {
  console.info(`Usage: npm run setup [-- options]

  -m, --messenger <name>  wechat | whatsapp | both   (skip the question)
  -y, --yes               accept defaults without asking
      --skip-install      do not run npm install
      --force             overwrite an existing bot.ts
  -h, --help              show this help`)
  process.exit(0)
}

process.exitCode = await runInitCli({
  force: values.force,
  messenger: values.messenger,
  skipInstall: values['skip-install'],
  yes: values.yes,
})
