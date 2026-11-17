#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  isPackageInstalled,
  isSupportedNode,
  runInit,
  starterBotSource,
  type InitDeps,
} from './init.ts'
import { CONFIG_FILE_NAME, readProjectConfig } from './config-file.ts'

/** Temporary project folder with a package.json. */
function project (name = 'my-bot'): string {
  const dir = mkdtempSync(join(tmpdir(), 'devchat-init-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }))
  return dir
}

/** Fake deps recording output and install calls. */
function fakeDeps (over: Partial<InitDeps> = {}): InitDeps & { lines: string[], installs: string[][], saves: boolean[] } {
  const lines: string[] = []
  const installs: string[][] = []
  const saves: boolean[] = []
  return {
    env: {},
    findChrome: () => ({ path: '/usr/bin/google-chrome', source: 'system' }),
    install: async (specs, _cwd, save) => { installs.push(specs); saves.push(save); return true },
    installChrome: async () => true,
    installs,
    interactive: false,
    lines,
    nodeVersion: '26.0.0',
    saves,
    print: l => lines.push(l),
    prompt: async () => '',
    ...over,
  }
}

test('isSupportedNode()', () => {
  assert.equal(isSupportedNode('26.0.0'), true)
  assert.equal(isSupportedNode('v27.1.2'), true)
  assert.equal(isSupportedNode('22.18.0'), false)
  assert.equal(isSupportedNode('garbage'), false)
})

test('runInit() stops with install instructions on old Node.js', async () => {
  const deps = fakeDeps({ nodeVersion: '20.11.0' })
  const r = await runInit({ cwd: project() }, deps)
  assert.equal(r.exitCode, 1)
  assert.ok(deps.lines.some(l => l.includes('needs Node.js 26')))
})

test('runInit() asks, installs WhatsApp only when chosen, writes config and bot.ts', async () => {
  const cwd = project()
  const deps = fakeDeps({ interactive: true, prompt: async () => '3' })
  const r = await runInit({ cwd }, deps)

  assert.equal(r.exitCode, 0)
  assert.deepEqual(r.messengers, [ 'wechat', 'whatsapp' ])
  assert.equal(deps.installs.length, 1)
  assert.match(deps.installs[0]![0]!, /^wechaty-puppet-whatsapp@/)
  assert.deepEqual(deps.saves, [ true ], 'user projects record the driver in package.json')
  assert.deepEqual(readProjectConfig(cwd), { messengers: [ 'wechat', 'whatsapp' ] })
  const bot = readFileSync(join(cwd, 'bot.ts'), 'utf8')
  assert.match(bot, /from 'devchat'/, 'user projects import the package')
  assert.ok(deps.lines.some(l => l.includes('npm start')))
  rmSync(cwd, { force: true, recursive: true })
})

test('runInit() re-asks on a bad answer and WeChat needs no install', async () => {
  const answers = [ 'telegram', '1' ]
  const deps = fakeDeps({ interactive: true, prompt: async () => answers.shift() ?? '' })
  const r = await runInit({ cwd: project() }, deps)
  assert.deepEqual(r.messengers, [ 'wechat' ])
  assert.equal(deps.installs.length, 0)
  assert.ok(deps.lines.some(l => l.includes('Please type 1')))
})

test('runInit() is non-interactive with --messenger / DEVCHAT_MESSENGERS / --yes', async () => {
  const a = fakeDeps()
  assert.deepEqual((await runInit({ cwd: project(), messenger: 'whatsapp', skipInstall: true }, a)).messengers, [ 'whatsapp' ])
  assert.equal(a.installs.length, 0, '--skip-install must not install')

  const b = fakeDeps({ env: { DEVCHAT_MESSENGERS: 'both' } })
  assert.deepEqual((await runInit({ cwd: project(), skipInstall: true }, b)).messengers, [ 'wechat', 'whatsapp' ])

  const c = fakeDeps({ interactive: true, prompt: async () => { throw new Error('must not prompt') } })
  assert.deepEqual((await runInit({ cwd: project(), yes: true }, c)).messengers, [ 'wechat' ])

  const d = fakeDeps()
  assert.equal((await runInit({ cwd: project(), messenger: 'telegram' }, d)).exitCode, 1)
})

test('runInit() retries a failed install once, then prints fixes', async () => {
  let calls = 0
  const deps = fakeDeps({ install: async () => { calls++; return false } })
  const cwd = project()
  const r = await runInit({ cwd, messenger: 'whatsapp' }, deps)
  assert.equal(r.exitCode, 1)
  assert.equal(calls, 2)
  assert.ok(deps.lines.some(l => l.includes('PUPPETEER_SKIP_DOWNLOAD')), 'WhatsApp-specific help')
  assert.equal(existsSync(join(cwd, CONFIG_FILE_NAME)), false, 'no config written on failure')
})

test('runInit() keeps an existing bot.ts unless --force, and skips installed drivers', async () => {
  const cwd = project()
  writeFileSync(join(cwd, 'bot.ts'), '// mine')
  mkdirSync(join(cwd, 'node_modules', 'wechaty-puppet-whatsapp'), { recursive: true })
  writeFileSync(join(cwd, 'node_modules', 'wechaty-puppet-whatsapp', 'package.json'), '{}')

  const deps = fakeDeps()
  await runInit({ cwd, messenger: 'whatsapp' }, deps)
  assert.equal(readFileSync(join(cwd, 'bot.ts'), 'utf8'), '// mine')
  assert.equal(deps.installs.length, 0, 'already installed')
  assert.equal(isPackageInstalled('wechaty-puppet-whatsapp', join(cwd, 'sub', 'dir')), true, 'walks up')

  await runInit({ cwd, force: true, messenger: 'whatsapp' }, fakeDeps())
  assert.notEqual(readFileSync(join(cwd, 'bot.ts'), 'utf8'), '// mine')
})

test('starter bot imports from source inside the devChat repo itself', async () => {
  const cwd = project('devchat')
  mkdirSync(join(cwd, 'src', 'mods'), { recursive: true })
  writeFileSync(join(cwd, 'src', 'mods', 'mod.ts'), '')
  const deps = fakeDeps()
  await runInit({ cwd, messenger: 'whatsapp' }, deps)
  assert.match(readFileSync(join(cwd, 'bot.ts'), 'utf8'), /from '\.\/src\/mods\/mod\.ts'/)
  assert.deepEqual(deps.saves, [ false ], 'never edits the tracked package.json of the devChat repo')
  assert.match(starterBotSource('devchat'), /startDevChat/)
})

test('runInit() downloads Chrome for WhatsApp only when no browser exists', async () => {
  let found: { path: string, source: 'bundled' } | undefined
  let downloads = 0
  const deps = fakeDeps({
    findChrome: () => found,
    installChrome: async () => { downloads++; found = { path: '/cache/chrome', source: 'bundled' }; return true },
  })
  const r = await runInit({ cwd: project(), messenger: 'whatsapp' }, deps)
  assert.equal(r.exitCode, 0)
  assert.equal(downloads, 1)
  assert.ok(deps.lines.some(l => l.includes('/cache/chrome')))

  const present = fakeDeps({ installChrome: async () => { throw new Error('must not download') } })
  assert.equal((await runInit({ cwd: project(), messenger: 'whatsapp' }, present)).exitCode, 0)

  const wechatOnly = fakeDeps({ findChrome: () => { throw new Error('must not look for Chrome') } })
  assert.equal((await runInit({ cwd: project(), messenger: 'wechat' }, wechatOnly)).exitCode, 0)
})

test('runInit() explains how to get Chrome when the download fails', async () => {
  const deps = fakeDeps({ findChrome: () => undefined, installChrome: async () => false })
  const r = await runInit({ cwd: project(), messenger: 'whatsapp' }, deps)
  assert.equal(r.exitCode, 1)
  assert.ok(deps.lines.some(l => l.includes('google.com/chrome')))
})
