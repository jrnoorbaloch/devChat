#!/usr/bin/env node
/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * npm `prepare` hook: installs the repository's pre-push git hook for
 * contributors.
 *
 * Contract that must be preserved: this script NEVER fails `npm install`.
 * It runs on every install of a git checkout, including Windows machines
 * without symlink rights, CI runners and folders where git is missing. Any
 * problem is reported as a one-line note and the script exits 0; the hook is
 * a contributor convenience, not something users need.
 */
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Install the hook; throws on any failure (caught below). */
function installHook (): void {
  const hooksPathResult = spawnSync(
    'git',
    [ 'rev-parse', '--path-format=absolute', '--git-path', 'devchat-hooks' ],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )
  if (hooksPathResult.error || hooksPathResult.status !== 0) {
    throw hooksPathResult.error ?? new Error('git rev-parse failed')
  }
  const hooksPath = hooksPathResult.stdout.trim()
  if (!hooksPath) {
    throw new Error('git did not return a hooks path')
  }

  mkdirSync(hooksPath, { recursive: true })
  const hookPath = resolve(hooksPath, 'pre-push')
  rmSync(hookPath, { force: true })
  // Symlinks need Developer Mode or admin rights on Windows; failure is fine.
  symlinkSync(resolve(repositoryRoot, 'scripts/pre-push.ts'), hookPath)

  const configResult = spawnSync(
    'git',
    [ 'config', '--local', 'core.hooksPath', hooksPath ],
    { cwd: repositoryRoot, stdio: 'ignore' },
  )
  if (configResult.error || configResult.status !== 0) {
    throw configResult.error ?? new Error('git config failed')
  }
}

if (existsSync(resolve(repositoryRoot, '.git')) && !process.env['CI']) {
  try {
    installHook()
  } catch (error) {
    console.info(`devChat: skipped installing the contributor git hook (${(error as Error).message}). This does not affect using devChat.`)
  }
}
