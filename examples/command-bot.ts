#!/usr/bin/env node
/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Command bot example.
 *
 * Shows the devChat built-in plugins working together:
 * - `CommandRouter` answers `/ping`, `/echo`, `/time`, `/roll` and `/help`;
 * - `AutoReply` greets people and answers a FAQ;
 * - both are rate limited per user so the bot cannot be flooded.
 *
 * Run: `npm run demo:commands` (choose an IM provider with DEVCHAT_PUPPET).
 */
import {
  AutoReply,
  CommandRouter,
  DevChatBuilder,
  ScanStatus,
  qrcodeValueToImageUrl,
  type Contact,
}                         from '../src/mods/mod.ts' // from 'devchat'

import qrTerm from 'qrcode-terminal'

const bot = DevChatBuilder.build({ name: 'devchat-command-bot' })

bot.use(
  CommandRouter({
    commands: {
      echo: {
        aliases: [ 'say' ],
        description: 'Repeat your text',
        handler: ({ rawArgs }) => rawArgs || 'Usage: /echo <text>',
      },
      ping: {
        description: 'Check that the bot is alive',
        handler: () => 'pong 🏓',
      },
      roll: {
        description: 'Roll a dice, e.g. /roll 20',
        handler: ({ args }) => {
          const sides = Math.max(2, Math.min(1000, Number(args[0]) || 6))
          return `🎲 You rolled ${1 + Math.floor(Math.random() * sides)} (d${sides})`
        },
      },
      time: {
        description: 'Show the server time',
        handler: () => new Date().toUTCString(),
      },
    },
    rateLimit: { intervalMs: 60_000, limit: 10 },
    requireMentionInRoom: true,
    unknownReply: 'Unknown command /{command}. Type /help to see all commands.',
  }),
  AutoReply({
    rateLimit: { intervalMs: 60_000, limit: 5 },
    requireMentionInRoom: true,
    rules: [
      { match: /^(hi|hello|salam|assalam o alaikum)\b/i, reply: 'Hello! 👋 I am a devChat bot. Type /help to see what I can do.' },
      { contains: true, match: 'devchat', reply: 'devChat docs: https://github.com/jrnoorbaloch/devChat' },
    ],
  }),
)

bot
  .on('scan', (qrcode: string, status: ScanStatus) => {
    if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
      qrTerm.generate(qrcode, { small: true })
      console.info('Scan to log in:', qrcodeValueToImageUrl(qrcode))
    }
  })
  .on('login',  (user: Contact) => console.info(`✅ ${user.name()} logged in`))
  .on('logout', (user: Contact) => console.info(`👋 ${user.name()} logged out`))
  .on('error',  (e: Error) => console.error('Bot error:', e))

bot.start().catch(async e => {
  console.error('Bot start() failed:', e)
  await bot.stop()
  process.exit(1)
})
