# Changelog

All notable changes to devChat are listed here.

## 2.0.0-alpha.18 (2026-11-17)

### Added

- **One-line installers:** `install.ps1` for Windows and `install.sh` for macOS/Linux. They check Git, Node.js 26+ and npm, offer to install what is missing, download devChat, install dependencies and run setup.
- **Setup wizard** (`npm run setup`, `devchat init`, `devchat-init`): asks WeChat, WhatsApp or both, installs only the drivers that choice needs, and writes `devchat.config.json` and a starter `bot.ts`. Every question also has a flag (`--messenger`, `--yes`, `--skip-install`) or the `DEVCHAT_MESSENGERS` variable, so CI and Docker work too.
- **`startDevChat()`:** runs one bot per chosen messenger with shared code. It prints login QR codes in the terminal, keeps one failing messenger from stopping the others, hides repeated errors and shuts down cleanly on Ctrl+C.
- **WhatsApp finds a browser by itself:** it uses an installed Google Chrome, Chromium or Microsoft Edge when puppeteer's own Chrome was never downloaded. This fixes "Could not find Chrome" on Windows. Setup downloads Chrome only if no browser exists, and `npm start` no longer reports WhatsApp as started without one.
- **No more broken Chrome downloads:** installing the WhatsApp driver skips puppeteer's automatic Chrome download. An interrupted download used to leave a half-written cache folder that made every later install fail. If Chrome must be downloaded, the broken folder is cleaned up first.
- **devChat dashboard:** `npm start` opens a local web page with the login QR code for each messenger and step-by-step scan instructions. The card switches to Connected by itself.
- **Chat window in the dashboard:** a chat list (groups and direct chats, newest first, unread counts, search) and a chat window per conversation with message bubbles. You can reply as the bot from the browser: Enter sends, Shift+Enter adds a new line, and messages are capped at 4,096 characters. A sent message shows at once and the driver's copy of it is not shown twice. On phones the window switches between list and chat. The dashboard also shows the account, message counts and a Log out button. It runs only on `localhost`, with a Host check and protection against cross-site requests. QR codes are drawn locally and verified to decode on 1x, 2x and phone screens. Turn it off with `DEVCHAT_UI=0`, or choose the port with `DEVCHAT_UI_PORT`.
- **Readable console:** WhatsApp's hundreds of `PUPPETEER PAGE LOG` lines and the info-level raw message dumps, which contained phone numbers and message secrets, are hidden unless `DEVCHAT_DEBUG` or `DEVCHAT_LOG` is set. Driver errors now show their type and code. Minified WhatsApp Web errors read "internal WhatsApp Web error t" instead of "t (t)".
- **Driver bugs no longer stop your bot:** `startDevChat()` logs promise errors that a messenger driver leaves unhandled, then keeps running. Before, Node.js exited. This fixes the WhatsApp crash `ERR_INIT: no cache manager` right after login, when a group update arrived before the driver's cache was ready.
- **`npm start`:** runs `bot.ts` and prints a one-line fix instead of a stack trace.
- **Friendly messenger names:** `puppet: 'whatsapp'` / `DEVCHAT_PUPPET=wechat`.
- **Browser QR page:** `https://devchat-docs.vercel.app/qrcode/<value>`. The code is drawn locally in the browser.
- **Plugins:** `CommandRouter` (slash commands, aliases, `/help`, rate limits, error isolation), `AutoReply` (keyword, RegExp and function rules), and `RateLimiter`.
- **Docs pages:** Troubleshooting and Configuration.

### Changed

- Every public name now uses devChat branding: `DevChatBuilder`, `DevChat`, `DevChatOptions`, `DevChatPlugin`, `DevChatInterface`, and more.
- Environment variables use the `DEVCHAT_` prefix (`DEVCHAT_PUPPET`, `DEVCHAT_LOG`, `DEVCHAT_TOKEN`, ...).
- CLI binaries: `devchat`, `devchat-init`, `devchat-doctor`, `devchat-version`, `devchat-io-client` and `devchat-puppet-install`.
- `npm install` never fails because of the contributor git hook, and the hook no longer needs symlinks, so there is no EPERM note on Windows.
- The Windows installer stops with a clear message instead of a PowerShell error block, and leaves the PowerShell window open.
- `package.json` declares an `allowScripts` policy, so npm 11.16+ no longer prints the "install scripts not yet covered by allowScripts" warning and npm 12 (which blocks unlisted install scripts) keeps working. puppeteer's Chrome download is denied because devChat uses the installed Chrome or Edge. Verified with npm 11.20 and 12.2.
- `qrcode-terminal` is now a runtime dependency, so QR codes print out of the box.

### Removed

- Obsolete Heroku, AppVeyor and Code Climate configuration.

For credits and third-party notices see [NOTICE](NOTICE).
