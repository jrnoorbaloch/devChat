#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { qrToSvg } from './qr-svg.ts'

// Same length/shape as a real WhatsApp login payload (239 chars).
const WHATSAPP_LIKE = '2@' + 'A'.repeat(100) + ',' + 'b'.repeat(44) + ',' + 'c'.repeat(44) + ',' + 'd'.repeat(44) + ',1'

test('qrToSvg() renders a square SVG with a quiet zone', () => {
  const svg = qrToSvg(WHATSAPP_LIKE, 300)
  const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  assert.ok(m, 'has a viewBox')
  assert.equal(m[1], m[2], 'square')
  const size = Number(m[1])
  assert.ok(size >= 21 + 8, 'at least version 1 plus quiet zone')
  assert.equal((size - 8 - 17) % 4, 0, 'QR size is 17 + 4 * version modules')
  const w = Number(/width="(\d+)"/.exec(svg)?.[1])
  assert.equal(w % size, 0, 'whole pixels per module')
  assert.ok(Math.abs(w - 300) <= size, 'close to the requested size')
  assert.ok((svg.match(/<rect /g) ?? []).length > 50, 'draws modules')
  assert.doesNotMatch(svg, /<script/i)
})

test('qrToSvg() is deterministic and rejects empty input', () => {
  assert.equal(qrToSvg('hello'), qrToSvg('hello'))
  assert.notEqual(qrToSvg('hello'), qrToSvg('hello!'))
  assert.throws(() => qrToSvg(''), /must not be empty/)
})
