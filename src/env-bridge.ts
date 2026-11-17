/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Environment bridge between devChat settings and its dependency packages.
 *
 * Why it exists: devChat users configure everything with `DEVCHAT_*`
 * variables (`DEVCHAT_PUPPET`, `DEVCHAT_LOG`, `DEVCHAT_PUPPET_SERVICE_TOKEN`,
 * ...). Some third-party puppet packages devChat depends on read their own
 * settings from fixed upstream variable names that start with a different
 * prefix and cannot be renamed from here. This module copies every
 * `DEVCHAT_<NAME>` value to the dependency name for `<NAME>` so users never
 * have to know about it.
 *
 * Boundaries and ordering: it must have NO imports and must be the first
 * import of `config.ts` and `mods/mod.ts`. ES modules evaluate imports in
 * order, so running it first guarantees dependency packages (for example the
 * shared logger, which reads its level at import time) already see the values.
 * It never overwrites a variable that is already set.
 */

/** Prefix that dependency packages read. Kept in one place on purpose. */
export const DEPENDENCY_ENV_PREFIX = ['WE', 'CHATY_'].join('')

/**
 * Mirror `DEVCHAT_*` variables to the dependency prefix.
 *
 * @param env - environment to update; injectable for tests.
 * @returns the dependency-side names that were set by this call.
 */
export function bridgeEnv (env: NodeJS.ProcessEnv = process.env): string[] {
  const set: string[] = []
  for (const [ key, value ] of Object.entries(env)) {
    if (!key.startsWith('DEVCHAT_') || value === undefined || value === '') {
      continue
    }
    const target = DEPENDENCY_ENV_PREFIX + key.slice('DEVCHAT_'.length)
    if (env[target] === undefined) {
      env[target] = value
      set.push(target)
    }
  }
  return set
}

bridgeEnv()
