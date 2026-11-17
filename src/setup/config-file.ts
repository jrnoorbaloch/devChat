/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * `devchat.config.json` - the project-level file written by `devchat init`
 * and read by the multi-bot runner.
 *
 * Why it exists: the messenger choice made once in the setup wizard has to be
 * remembered so `npm start` can launch the right bots without flags. Keeping
 * the file tiny and JSON makes it easy to edit by hand.
 *
 * Boundaries: owns reading, validating and writing this one file. It never
 * installs anything; that is `init.ts`'s job.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { isMessengerId, type MessengerId } from './messengers.ts'

/** File name, relative to the project root. */
export const CONFIG_FILE_NAME = 'devchat.config.json'

/** Shape of `devchat.config.json`. */
export interface DevChatProjectConfig {
  /** Messengers to run, e.g. `["wechat", "whatsapp"]`. */
  messengers: MessengerId[]
}

/**
 * Validate parsed JSON as a {@link DevChatProjectConfig}.
 *
 * @throws Error with a human-readable message when the shape is wrong, so the
 *         user can fix the file (or rerun `npm run setup`).
 */
export function validateProjectConfig (value: unknown): DevChatProjectConfig {
  const messengers = (value as { messengers?: unknown } | null)?.messengers
  if (!Array.isArray(messengers) || messengers.length === 0) {
    throw new Error(`${CONFIG_FILE_NAME}: "messengers" must be a non-empty list such as ["wechat"] or ["wechat", "whatsapp"].`)
  }
  for (const m of messengers) {
    if (!isMessengerId(m)) {
      throw new Error(`${CONFIG_FILE_NAME}: unknown messenger "${String(m)}". Use "wechat" and/or "whatsapp".`)
    }
  }
  return { messengers: [ ...new Set(messengers as MessengerId[]) ] }
}

/**
 * Read `devchat.config.json` from `cwd`.
 *
 * @returns the validated config, or `undefined` when the file does not exist.
 * @throws Error when the file exists but is not valid JSON or has a bad shape.
 */
export function readProjectConfig (cwd: string): DevChatProjectConfig | undefined {
  const file = join(cwd, CONFIG_FILE_NAME)
  if (!existsSync(file)) {
    return undefined
  }
  let json: unknown
  try {
    json = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`${CONFIG_FILE_NAME} is not valid JSON: ${(e as Error).message}`)
  }
  return validateProjectConfig(json)
}

/** Write `devchat.config.json` into `cwd` (pretty-printed, trailing newline). */
export function writeProjectConfig (cwd: string, config: DevChatProjectConfig): string {
  const file = join(cwd, CONFIG_FILE_NAME)
  writeFileSync(file, JSON.stringify(validateProjectConfig(config), null, 2) + '\n')
  return file
}
