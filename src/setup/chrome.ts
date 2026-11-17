/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Chrome discovery for the WhatsApp driver.
 *
 * Why it exists: WhatsApp runs through WhatsApp Web inside a headless
 * Chromium browser launched by puppeteer. Puppeteer only looks for the exact
 * Chrome build it downloaded during `npm install`. That download is often
 * skipped or blocked (install scripts disabled, proxies, antivirus), and the
 * bot then fails with "Could not find Chrome". Most computers already have a
 * suitable browser, and every Windows 10/11 machine ships Microsoft Edge
 * (Chromium), so devChat looks for one before giving up.
 *
 * Search order (first hit wins):
 *   1. `PUPPETEER_EXECUTABLE_PATH` (the user's explicit choice)
 *   2. the Chrome build puppeteer downloaded, if it exists on disk
 *   3. installed Google Chrome, then Chromium, then Microsoft Edge
 *
 * Boundaries: discovery is pure apart from the injected `exists` / `bundled`
 * probes, so it is unit tested for every OS. `installBundledChrome()` is the
 * only function with side effects (it runs puppeteer's browser installer).
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, posix, win32 } from 'node:path'

import spawn from 'cross-spawn'

/** Where a browser was found. */
export type ChromeSource = 'env' | 'bundled' | 'system'

/** A usable Chromium-based browser. */
export interface ChromeLocation {
  path: string
  source: ChromeSource
}

/** Probes used by {@link findChrome}; injectable for tests. */
export interface FindChromeOptions {
  /** Project folder whose `node_modules` holds puppeteer. Default `process.cwd()`. */
  cwd?: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  /** Whether a file exists. Default `fs.existsSync` (errors count as "no"). */
  exists?: (path: string) => boolean
  /** Path of puppeteer's own Chrome build, or `undefined` if puppeteer is absent. */
  bundled?: () => string | undefined
}

/**
 * Well-known install locations of Chromium-based browsers, most preferred
 * first. Exported for tests and for the troubleshooting docs.
 */
export function systemChromeCandidates (
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (platform === 'win32') {
    const roots = [
      env['PROGRAMFILES'] ?? 'C:\\Program Files',
      env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
      env['LOCALAPPDATA'],
    ].filter((r): r is string => !!r)
    return [
      ...roots.map(r => win32.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...roots.map(r => win32.join(r, 'Chromium', 'Application', 'chrome.exe')),
      ...roots.map(r => win32.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    ]
  }
  if (platform === 'darwin') {
    const apps = [ '/Applications', posix.join(env['HOME'] ?? '~', 'Applications') ]
    return [
      ...apps.map(a => posix.join(a, 'Google Chrome.app/Contents/MacOS/Google Chrome')),
      ...apps.map(a => posix.join(a, 'Chromium.app/Contents/MacOS/Chromium')),
      ...apps.map(a => posix.join(a, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge')),
    ]
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ]
}

/** Safe `existsSync`: sandboxed runtimes throw instead of returning false. */
function safeExists (path: string): boolean {
  try {
    return existsSync(path)
  } catch {
    return false
  }
}

/**
 * Path of the Chrome build puppeteer expects, resolved from the project's
 * `node_modules`. Returns `undefined` when puppeteer is not installed.
 */
export function bundledChromePath (cwd: string = process.cwd()): string | undefined {
  try {
    const require = createRequire(join(cwd, 'package.json'))
    const puppeteer = require('puppeteer') as { executablePath: () => string }
    return puppeteer.executablePath()
  } catch {
    return undefined
  }
}

/**
 * Find a Chromium-based browser for WhatsApp.
 *
 * @returns the first usable browser in the order described in the file
 *          header, or `undefined` when none exists.
 */
export function findChrome (options: FindChromeOptions = {}): ChromeLocation | undefined {
  const env      = options.env ?? process.env
  const exists   = options.exists ?? safeExists
  const platform = options.platform ?? process.platform
  const bundled  = options.bundled ?? (() => bundledChromePath(options.cwd ?? process.cwd()))

  const fromEnv = env['PUPPETEER_EXECUTABLE_PATH']
  if (fromEnv && exists(fromEnv)) {
    return { path: fromEnv, source: 'env' }
  }
  const own = bundled()
  if (own && exists(own)) {
    return { path: own, source: 'bundled' }
  }
  for (const candidate of systemChromeCandidates(platform, env)) {
    if (exists(candidate)) {
      return { path: candidate, source: 'system' }
    }
  }
  return undefined
}

/** Plain-language help when no browser can be found or downloaded. */
export function chromeMissingHelp (platform: NodeJS.Platform = process.platform): string[] {
  const example = platform === 'win32'
    ? '$env:PUPPETEER_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
    : 'export PUPPETEER_EXECUTABLE_PATH="/path/to/chrome"'
  return [
    'WhatsApp needs Google Chrome (or Microsoft Edge / Chromium), and none was found.',
    '  1. Easiest: install Google Chrome from https://www.google.com/chrome/ and run:  npm run setup',
    '  2. Or let devChat download it:  npx puppeteer browsers install chrome',
    `  3. Or point devChat to a browser you have:  ${example}`,
  ]
}

/**
 * Download the Chrome build puppeteer expects (`npx puppeteer browsers
 * install chrome`), using the puppeteer version installed in `cwd`.
 *
 * @returns `true` when the installer exited successfully.
 */
export function installBundledChrome (cwd: string): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn('npx', [ '--no-install', 'puppeteer', 'browsers', 'install', 'chrome' ], {
      cwd,
      stdio: 'inherit',
    })
    child.on('error', () => resolve(false))
    child.on('close', code => resolve(code === 0))
  })
}
