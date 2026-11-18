#!/usr/bin/env node
/**
 * Dashboard server tests. They open a real local HTTP server, which Deno's
 * test permissions (no --allow-net) do not allow, so they run on Node.js.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request } from 'node:http'

import { PuppetMock } from 'wechaty-puppet-mock'
import * as PUPPET from 'wechaty-puppet'

import { DevChatBuilder } from '../devchat-builder.ts'
import { attachBotToDashboard, startDashboard } from './dashboard.ts'

const skip = 'Deno' in globalThis

/** Minimal HTTP client that lets tests set any Host header. */
function http (url: string, opts: { method?: string, headers?: Record<string, string> } = {}): Promise<{ status: number, body: string, type: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: opts.headers, method: opts.method ?? 'GET' }, res => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => resolve({ body, status: res.statusCode ?? 0, type: String(res.headers['content-type']) }))
    })
    req.on('error', reject)
    req.end()
  })
}

test('dashboard serves the page and state on localhost only', { skip }, async () => {
  const d = await startDashboard({ open: false, port: 0 })
  try {
    const page = await http(d.url)
    assert.equal(page.status, 200)
    assert.match(page.type, /text\/html/)
    assert.match(page.body, /devChat Dashboard/)

    d.update('whatsapp', { label: 'WhatsApp', status: 'connected', user: 'Bot' })
    const state = JSON.parse((await http(d.url + '/api/state')).body)
    assert.equal(state.messengers[0].status, 'connected')
    assert.equal(state.messengers[0].user, 'Bot')

    const rebinding = await http(d.url, { headers: { Host: 'evil.example:80' } })
    assert.equal(rebinding.status, 403, 'DNS-rebinding requests are refused')
  } finally {
    await d.close()
  }
})

test('logout needs POST + X-DevChat-Action and calls the handler', { skip }, async () => {
  const d = await startDashboard({ open: false, port: 0 })
  const calls: string[] = []
  d.onLogout(async id => { calls.push(id) })
  d.update('wechat', { label: 'WeChat', status: 'connected' })
  try {
    assert.equal((await http(d.url + '/api/logout?messenger=wechat', { method: 'POST' })).status, 403, 'no header -> refused (CSRF)')
    assert.equal((await http(d.url + '/api/logout?messenger=wechat', { method: 'GET' })).status, 404)
    assert.equal((await http(d.url + '/api/logout?messenger=whatsapp', { headers: { 'X-DevChat-Action': '1' }, method: 'POST' })).status, 404, 'unknown messenger')
    const ok = await http(d.url + '/api/logout?messenger=wechat', { headers: { 'X-DevChat-Action': '1' }, method: 'POST' })
    assert.equal(ok.status, 200)
    assert.deepEqual(calls, [ 'wechat' ])
  } finally {
    await d.close()
  }
})

test('state keeps QR only while scanning, counts messages and caps the feed', { skip }, async () => {
  const d = await startDashboard({ feedSize: 2, open: false, port: 0 })
  try {
    d.update('whatsapp', { label: 'WhatsApp', qrSvg: '<svg/>', status: 'scan' })
    assert.equal(d.snapshot().messengers[0]!.qrSvg, '<svg/>')
    d.update('whatsapp', { status: 'connected', user: 'Bot' })
    assert.equal(d.snapshot().messengers[0]!.qrSvg, undefined, 'QR is dropped after login')

    for (const text of [ 'a', 'b', 'c' ]) {
      d.pushMessage({ at: Date.now(), chat: 'Direct message', from: 'Ali', messenger: 'WhatsApp', self: false, text })
    }
    d.pushMessage({ at: Date.now(), chat: 'Direct message', from: 'You (bot)', messenger: 'WhatsApp', self: true, text: 'pong' })
    const snap = d.snapshot()
    assert.deepEqual(snap.feed.map(e => e.text), [ 'pong', 'c' ], 'newest first, capped')
    assert.equal(snap.messengers[0]!.received, 3)
    assert.equal(snap.messengers[0]!.sent, 1)
  } finally {
    await d.close()
  }
})

test('event stream pushes live state to the browser', { skip }, async () => {
  const d = await startDashboard({ open: false, port: 0 })
  try {
    const chunks: string[] = []
    const req = request(d.url + '/api/events', res => res.on('data', c => chunks.push(String(c))))
    req.end()
    await new Promise(resolve => setTimeout(resolve, 100))
    d.update('wechat', { label: 'WeChat', status: 'scan', qrSvg: '<svg id="x"/>' })
    await new Promise(resolve => setTimeout(resolve, 100))
    req.destroy()
    const text = chunks.join('')
    assert.match(text, /^event: state/m)
    assert.match(text, /svg id=\\"x\\"/)
  } finally {
    await d.close()
  }
})

test('attachBotToDashboard() follows a real bot: scan -> connected -> messages', { skip }, async () => {
  const d = await startDashboard({ open: false, port: 0 })
  const puppet = new PuppetMock()
  const bot = DevChatBuilder.build({ puppet })
  attachBotToDashboard(d, bot, 'whatsapp', 'WhatsApp')
  try {
    assert.equal(d.snapshot().messengers[0]!.status, 'starting')
    await bot.start()

    puppet.emit('scan', { qrcode: '2@login-code', status: PUPPET.types.ScanStatus.Waiting })
    await new Promise(resolve => setTimeout(resolve, 20))
    let m = d.snapshot().messengers[0]!
    assert.equal(m.status, 'scan')
    assert.match(m.qrSvg ?? '', /^<svg/)

    const me = puppet.mocker.createContact({ name: 'Bot' })
    const ali = puppet.mocker.createContact({ name: 'Ali' })
    await puppet.mocker.login(me)
    for (let i = 0; i < 50 && d.snapshot().messengers[0]!.status !== 'connected'; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    m = d.snapshot().messengers[0]!
    assert.equal(m.status, 'connected')
    assert.equal(m.user, 'Bot')

    ali.say('hello bot').to(me)
    for (let i = 0; i < 50 && d.snapshot().feed.length === 0; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    const entry = d.snapshot().feed[0]
    assert.equal(entry?.text, 'hello bot')
    assert.equal(entry?.from, 'Ali')
    assert.equal(entry?.chat, 'Direct message')
  } finally {
    await bot.stop()
    await d.close()
  }
})
