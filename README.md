<!-- markdownlint-disable MD033 MD041 -->
<p align="center">
  <img src="website/assets/og.png" alt="devChat – open-source TypeScript chatbot SDK for WeChat and WhatsApp" width="720">
</p>

<h1 align="center">devChat</h1>

<p align="center">
  <b>Open-source TypeScript chatbot SDK for Node.js.</b><br>
  Install with one command, choose WeChat, WhatsApp or both, and get slash commands, auto-replies and rate limiting built in.
</p>

<p align="center">
  <a href="https://devchat-docs.vercel.app"><b>Documentation</b></a> ·
  <a href="https://devchat-docs.vercel.app/getting-started">Getting started</a> ·
  <a href="https://devchat-docs.vercel.app/plugins">Plugins</a> ·
  <a href="https://devchat-docs.vercel.app/troubleshooting">Troubleshooting</a>
</p>

<p align="center">
  <a href="https://github.com/jrnoorbaloch/devChat/actions/workflows/node.js.yml"><img src="https://github.com/jrnoorbaloch/devChat/actions/workflows/node.js.yml/badge.svg" alt="Node.js CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-3ddc97" alt="License: Apache-2.0"></a>
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6" alt="TypeScript">
  <img src="https://img.shields.io/badge/node-%3E%3D26-339933" alt="Node.js >= 26">
</p>

---

## Install in one command

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/jrnoorbaloch/devChat/main/install.ps1 | iex
```

**macOS / Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/jrnoorbaloch/devChat/main/install.sh | bash
```

The installer checks Git, Node.js 26+ and npm. If something is missing it offers to install it, and it always asks first. Then it downloads devChat, installs the dependencies, and asks:

```text
Which messenger do you want your bot to use?
  1) WeChat
  2) WhatsApp
  3) Both
```

Only what you choose gets installed. WhatsApp's headless Chrome is skipped if you pick WeChat only. Then:

```sh
cd devChat
npm start        # scan the QR code with your phone, then send /help to the bot
```

Something went wrong? Every error prints its fix, and the
[troubleshooting guide](https://devchat-docs.vercel.app/troubleshooting) has the rest.

## Your bot in 20 lines

`npm run setup` creates `bot.ts`. The same code runs on every messenger you picked:

```ts
import { startDevChat, CommandRouter, AutoReply } from 'devchat'

await startDevChat({
  setup: (bot, messenger) => {
    bot.use(
      CommandRouter({
        commands: {
          ping: () => 'pong',
          echo: { description: 'Repeat text', aliases: ['say'], handler: ({ rawArgs }) => rawArgs },
        },
        rateLimit: { limit: 10, intervalMs: 60_000 },
        requireMentionInRoom: true,
      }),
      AutoReply({
        rules: [
          { match: 'hi', reply: 'Hello! 👋 Type /help' },
          { match: /weather in (\w+)/i, reply: (_msg, m) => `Checking weather for ${m?.[1]}…` },
        ],
      }),
    )
    bot.on('message', m => console.log(`[${messenger}] ${m.text()}`))
  },
})
```

## Features

- 🚀 **One-line install** with a setup wizard: WeChat, WhatsApp or both.
- 🔀 **Several messengers, one codebase:** `startDevChat()` runs a bot per messenger, and one failing messenger never stops the others.
- 🧭 **`CommandRouter`:** `/slash` commands with quoted arguments, aliases, an automatic `/help`, and error isolation.
- 💬 **`AutoReply`:** keyword, RegExp and function rules for FAQ, support and greeter bots.
- 🚦 **`RateLimiter`:** per-user throttling that protects your bot account.
- 📱 **QR login in the terminal**, plus a browser link that draws the code locally.
- 🛡️ **Errors you can act on:** setup and start print a fix, not a stack trace (`DEVCHAT_DEBUG=1` shows details).
- 🧪 **Testable without a phone** using the mock driver.

## For developers

```sh
git clone https://github.com/jrnoorbaloch/devChat.git
cd devChat
npm ci
npm run setup -- --messenger whatsapp --yes   # no questions (CI / Docker)
npm test                                      # lint + typecheck + unit tests
```

A plain `npm install` never prompts and never downloads extra drivers. Setup is a separate, explicit step.

```text
src/              SDK source (TypeScript, run directly by Node.js 26+)
src/setup/        setup wizard, multi-messenger runner, messenger registry
src/plugins/      CommandRouter, AutoReply, RateLimiter
bin/              CLI: devchat, devchat-init, devchat-doctor, ...
install.sh / .ps1 one-line installers
website/          documentation site (deployed to Vercel)
```

See [DEVELOPMENT.md](DEVELOPMENT.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Important: account safety

WhatsApp support uses WhatsApp Web, not the official WhatsApp Business API, and WeChat support uses the web protocol. Messengers may restrict automated accounts. Use a test number, keep rate limits on, and never mass-message people.

## License and credits

devChat is open source under the [Apache License 2.0](LICENSE). Third-party credits and notices are listed in [NOTICE](NOTICE).

---

**Keywords:** chatbot SDK, TypeScript chatbot framework, Node.js bot, WhatsApp bot, WeChat bot, one-line install, RPA, conversational AI, slash commands, auto reply bot, rate limiter.
