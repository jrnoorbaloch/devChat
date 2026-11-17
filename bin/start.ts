#!/usr/bin/env node
/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `npm start` entry point: runs the project's `bot.ts`.
 *
 * Why a wrapper instead of `node bot.ts`: before `npm run setup` has created
 * `bot.ts`, Node.js would fail with a module-not-found stack trace. This prints
 * the one command the user needs instead. Errors thrown while starting are
 * printed as one readable line instead of a stack trace.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const botFile = join(process.cwd(), 'bot.ts')

if (!existsSync(botFile)) {
  console.info('No bot.ts yet. Run the setup first:\n\n    npm run setup\n')
  process.exit(1)
}

try {
  await import(pathToFileURL(botFile).href)
} catch (error) {
  // Show one readable line; the full stack only when debugging.
  if (process.env['DEVCHAT_DEBUG']) {
    console.error(error)
  } else {
    console.error(`\n✖ ${(error as Error).message ?? String(error)}`)
    console.error('  (Set DEVCHAT_DEBUG=1 to see technical details.)\n')
  }
  process.exit(1)
}
