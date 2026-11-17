#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import openGraph from 'open-graph'
import type { DevChat } from '../mods/mod.ts'
import { MessageImpl } from './message.ts'

import { devchatifyUserModule } from './mod.ts'
import { UrlLinkImpl } from './url-link.ts'

const devchat = {
  puppet: {} as any,
} as any as DevChat

const UrlLinkTest = devchatifyUserModule(UrlLinkImpl)(devchat)

test('UrlLink.create() reads Open Graph metadata', async t => {
  const URL = 'https://devchat-docs.vercel.app'
  const HTML = `
    <html><head>
      <meta property="og:title" content="Getting started | devChat Docs">
      <meta property="og:description" content="Run your first devChat bot in minutes.">
      <meta property="og:image" content="/assets/og.png">
    </head></html>
  `
  const EXPECTED_PAYLOAD = {
    description: 'Run your first devChat bot in minutes.',
    title: 'Getting started | devChat Docs',
  }
  type RequestCallback = Parameters<typeof openGraph.getHTML>[1]

  t.mock.method(openGraph, 'getHTML', (
    _url: Parameters<typeof openGraph.getHTML>[0],
    callbackOrUserAgent: RequestCallback | string,
    callback?: RequestCallback,
  ) => {
    const requestCallback = callback ?? callbackOrUserAgent
    if (typeof requestCallback === 'function') {
      requestCallback(null, HTML)
    }
  })

  const urlLink = await UrlLinkTest.create(URL)
  assert.equal(urlLink.title(),        EXPECTED_PAYLOAD.title, 'should have title')
  assert.equal(urlLink.description(),  EXPECTED_PAYLOAD.description, 'should have description')
  assert.equal(urlLink.url(),          URL, 'should have url')
  assert.equal(urlLink.thumbnailUrl(), 'https://devchat-docs.vercel.app/assets/og.png', 'should have thumbnailUrl')
})

test('UrlLink.valid()', async _t => {
  const urlLink = new UrlLinkTest({} as any)
  assert.ok(UrlLinkImpl.valid(urlLink), 'should pass the validation of UrlLinkImpl')
  assert.ok(!MessageImpl.valid(urlLink), 'should not pass the validation of MessageImpl')
})
