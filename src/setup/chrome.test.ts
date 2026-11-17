#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  chromeMissingHelp,
  findChrome,
  npmEnvWithoutBrowserDownload,
  removeBrokenBrowserDownload,
  systemChromeCandidates,
} from './chrome.ts'

const WIN_ENV = {
  LOCALAPPDATA: 'C:\\Users\\hashir\\AppData\\Local',
  PROGRAMFILES: 'C:\\Program Files',
  'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
}

test('Windows candidates prefer Chrome, then Chromium, then the built-in Edge', () => {
  const c = systemChromeCandidates('win32', WIN_ENV)
  assert.equal(c[0], 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  assert.ok(c.includes('C:\\Users\\hashir\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'))
  assert.ok(c.includes('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'))
  assert.ok(c.indexOf('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe') > c.indexOf('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'))
})

test('macOS and Linux candidates', () => {
  assert.equal(systemChromeCandidates('darwin', { HOME: '/Users/a' })[0], '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  assert.ok(systemChromeCandidates('linux', {}).includes('/usr/bin/chromium-browser'))
})

test('findChrome() order: env > bundled > system, skipping paths that do not exist', () => {
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const onDisk = new Set([ edge, '/cache/chrome' ])
  const exists = (p: string) => onDisk.has(p)

  assert.deepEqual(
    findChrome({ bundled: () => '/missing/chrome', env: WIN_ENV, exists, platform: 'win32' }),
    { path: edge, source: 'system' },
    'falls back to Edge when puppeteer Chrome was never downloaded (the reported Windows error)',
  )
  assert.deepEqual(
    findChrome({ bundled: () => '/cache/chrome', env: WIN_ENV, exists, platform: 'win32' }),
    { path: '/cache/chrome', source: 'bundled' },
  )
  onDisk.add('D:\\chrome.exe')
  assert.deepEqual(
    findChrome({ bundled: () => '/cache/chrome', env: { ...WIN_ENV, PUPPETEER_EXECUTABLE_PATH: 'D:\\chrome.exe' }, exists, platform: 'win32' }),
    { path: 'D:\\chrome.exe', source: 'env' },
  )
  assert.equal(findChrome({ bundled: () => undefined, env: {}, exists: () => false, platform: 'linux' }), undefined)
})

test('chromeMissingHelp() gives OS-specific commands', () => {
  assert.ok(chromeMissingHelp('win32').some(l => l.includes('$env:PUPPETEER_EXECUTABLE_PATH')))
  assert.ok(chromeMissingHelp('linux').some(l => l.includes('export PUPPETEER_EXECUTABLE_PATH')))
})

test('npm installs skip the puppeteer download unless the user decided otherwise', () => {
  assert.equal(npmEnvWithoutBrowserDownload({})['PUPPETEER_SKIP_DOWNLOAD'], '1')
  assert.equal(npmEnvWithoutBrowserDownload({ PUPPETEER_SKIP_DOWNLOAD: '0' })['PUPPETEER_SKIP_DOWNLOAD'], '0')
})

test('removeBrokenBrowserDownload() deletes only an interrupted version folder', () => {
  const exe = '/home/u/.cache/puppeteer/chrome/win64-148.0.7778.97/chrome-win64/chrome.exe'
  const versionDir = '/home/u/.cache/puppeteer/chrome/win64-148.0.7778.97'
  const removed: string[] = []
  const ops = (present: string[]) => ({ exists: (p: string) => present.includes(p), remove: (p: string) => { removed.push(p) } })

  assert.equal(removeBrokenBrowserDownload(exe, ops([ versionDir ])), versionDir, 'folder without exe (the reported error)')
  assert.deepEqual(removed, [ versionDir ])
  assert.equal(removeBrokenBrowserDownload(exe, ops([ versionDir, exe ])), undefined, 'complete download is kept')
  assert.equal(removeBrokenBrowserDownload(exe, ops([])), undefined, 'nothing downloaded yet')
  assert.equal(removeBrokenBrowserDownload(undefined, ops([])), undefined)
  assert.equal(removeBrokenBrowserDownload('/usr/bin/chrome', ops([ '/usr' ])), undefined, 'never touches non-cache paths')
  assert.equal(removed.length, 1)
})
