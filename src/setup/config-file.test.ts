#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CONFIG_FILE_NAME,
  readProjectConfig,
  validateProjectConfig,
  writeProjectConfig,
} from './config-file.ts'

test('write then read round-trips and deduplicates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devchat-cfg-'))
  assert.equal(readProjectConfig(dir), undefined, 'missing file -> undefined')
  writeProjectConfig(dir, { messengers: [ 'whatsapp', 'whatsapp' ] })
  assert.deepEqual(readProjectConfig(dir), { messengers: [ 'whatsapp' ] })
})

test('invalid files give readable errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devchat-cfg-'))
  writeFileSync(join(dir, CONFIG_FILE_NAME), '{ not json')
  assert.throws(() => readProjectConfig(dir), /not valid JSON/)
  assert.throws(() => validateProjectConfig({ messengers: [] }), /non-empty/)
  assert.throws(() => validateProjectConfig({ messengers: [ 'telegram' ] }), /unknown messenger "telegram"/)
  assert.throws(() => validateProjectConfig(null), /non-empty/)
})
