# Changelog

All notable changes to devChat are listed here.

## 2.0.0-alpha.18 (2026-11-17)

### Added

- **One-line installers:** `install.ps1` for Windows and `install.sh` for macOS/Linux. They check Git, Node.js 26+ and npm, offer to install what is missing, download devChat, install dependencies and run setup.
- **Setup wizard** (`npm run setup`, `devchat init`, `devchat-init`): asks WeChat, WhatsApp or both, installs only the drivers that choice needs, and writes `devchat.config.json` and a starter `bot.ts`. Every question also has a flag (`--messenger`, `--yes`, `--skip-install`) or the `DEVCHAT_MESSENGERS` variable, so CI and Docker work too.
- **`startDevChat()`:** runs one bot per chosen messenger with shared code. It prints login QR codes in the terminal, keeps one failing messenger from stopping the others, hides repeated errors and shuts down cleanly on Ctrl+C.
- **`npm start`:** runs `bot.ts` and prints a one-line fix instead of a stack trace.
- **Friendly messenger names:** `puppet: 'whatsapp'` / `DEVCHAT_PUPPET=wechat`.
- **Browser QR page:** `https://devchat-docs.vercel.app/qrcode/<value>`. The code is drawn locally in the browser.
- **Plugins:** `CommandRouter` (slash commands, aliases, `/help`, rate limits, error isolation), `AutoReply` (keyword, RegExp and function rules), and `RateLimiter`.
- **Docs pages:** Troubleshooting and Configuration.

### Changed

- Every public name now uses devChat branding: `DevChatBuilder`, `DevChat`, `DevChatOptions`, `DevChatPlugin`, `DevChatInterface`, and more.
- Environment variables use the `DEVCHAT_` prefix (`DEVCHAT_PUPPET`, `DEVCHAT_LOG`, `DEVCHAT_TOKEN`, ...).
- CLI binaries: `devchat`, `devchat-init`, `devchat-doctor`, `devchat-version`, `devchat-io-client` and `devchat-puppet-install`.
- `npm install` never fails because of the contributor git hook. This was a problem on Windows without symlink rights.
- `qrcode-terminal` is now a runtime dependency, so QR codes print out of the box.

### Removed

- Obsolete Heroku, AppVeyor and Code Climate configuration.

For credits and third-party notices see [NOTICE](NOTICE).
