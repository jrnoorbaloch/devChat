/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Local dashboard: a small web UI that `npm start` opens in the browser.
 *
 * Why it exists: logging in by scanning a QR code in a terminal is fragile
 * (fonts, window size, log noise scrolling it away). The dashboard shows each
 * messenger's live status, its login QR code, the logged-in account, a live
 * feed of messages and a logout button, so non-technical users can run a bot
 * without reading logs.
 *
 * Security model (keep it):
 * - listens on 127.0.0.1 only, never on the network;
 * - rejects requests whose Host header is not localhost (DNS rebinding);
 * - sends no CORS headers, so other websites cannot read the event stream;
 * - state-changing requests are POST and need the `X-DevChat-Action` header,
 *   which browsers cannot send cross-site without a CORS preflight we refuse.
 * QR codes are rendered locally (`qr-svg.ts`); nothing leaves the computer.
 *
 * Boundaries: owns the HTTP server, the in-memory state and the page. It does
 * not own bots; `attachBotToDashboard()` subscribes to a bot's events, and the
 * runner (`runner.ts`) decides when to start it.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import spawn from 'cross-spawn'

import type { DevChatInterface } from '../devchat/mod.ts'

import type { MessengerId } from './messengers.ts'
import { qrToSvg } from './qr-svg.ts'

/** Lifecycle of one messenger as shown in the UI. */
export type MessengerStatus = 'starting' | 'scan' | 'connected' | 'logged-out' | 'error'

/** What the dashboard knows about one messenger. */
export interface MessengerState {
  id: MessengerId
  label: string
  status: MessengerStatus
  /** Inline SVG of the current login QR code (status `scan` only). */
  qrSvg?: string
  /** Logged-in account name (status `connected`). */
  user?: string
  /** Last error text, shown on the card. */
  error?: string
  since: number
  received: number
  sent: number
}

/** One entry of the live message feed. */
export interface FeedEntry {
  at: number
  messenger: string
  chat: string
  from: string
  text: string
  self: boolean
}

/** Options for {@link startDashboard}. */
export interface DashboardOptions {
  /** First port to try. Default `DEVCHAT_UI_PORT` or 3000; the next 20 are tried if busy. Use 0 for any free port. */
  port?: number
  /** Open the dashboard in the default browser. Default `true` (not in CI). */
  open?: boolean
  /** Messages kept in the feed. Default 100. */
  feedSize?: number
}

/** Handle returned by {@link startDashboard}. */
export interface Dashboard {
  url: string
  /** Create or update a messenger card. */
  update: (id: MessengerId, patch: Partial<MessengerState> & { label?: string }) => void
  /** Add a message to the live feed. */
  pushMessage: (entry: FeedEntry) => void
  /** Register what the Logout button does for a messenger. */
  onLogout: (handler: (id: MessengerId) => Promise<void>) => void
  /** Current snapshot (also served at `/api/state`). */
  snapshot: () => { messengers: MessengerState[], feed: FeedEntry[] }
  close: () => Promise<void>
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/** Open `url` in the user's default browser; failures are ignored. */
export function openInBrowser (url: string, platform: NodeJS.Platform = process.platform): void {
  const [ cmd, args ] = platform === 'win32'
    ? [ 'cmd', [ '/c', 'start', '""', url ] ]
    : platform === 'darwin'
      ? [ 'open', [ url ] ]
      : [ 'xdg-open', [ url ] ]
  try {
    const child = spawn(cmd, args as string[], { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
  } catch {
    // No browser available (server, container): the URL is printed anyway.
  }
}

/** Listen on the first free port starting at `port` (127.0.0.1 only). */
async function listen (server: Server, port: number): Promise<number> {
  const attempts = port === 0 ? 1 : 21
  for (let i = 0; i < attempts; i++) {
    const tryPort = port === 0 ? 0 : port + i
    const ok = await new Promise<boolean>((resolve, reject) => {
      const onError = (e: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (e.code === 'EADDRINUSE') resolve(false)
        else reject(e)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve(true)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(tryPort, '127.0.0.1')
    })
    if (ok) {
      return (server.address() as AddressInfo).port
    }
  }
  throw new Error(`No free port for the dashboard between ${port} and ${port + attempts - 1}. Set DEVCHAT_UI_PORT.`)
}

/**
 * Start the dashboard server.
 *
 * @returns a handle to feed it state; resolves once it is listening.
 */
export async function startDashboard (options: DashboardOptions = {}): Promise<Dashboard> {
  const feedSize   = options.feedSize ?? 100
  const messengers = new Map<MessengerId, MessengerState>()
  const feed: FeedEntry[] = []
  const clients    = new Set<ServerResponse>()
  let logoutHandler: ((id: MessengerId) => Promise<void>) | undefined

  const snapshot = () => ({ feed: [ ...feed ], messengers: [ ...messengers.values() ] })

  const broadcast = (event: string, data: unknown) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of clients) {
      res.write(payload)
    }
  }

  const send = (res: ServerResponse, status: number, type: string, body: string) => {
    res.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Type': type,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    })
    res.end(body)
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!LOCAL_HOST.test(req.headers.host ?? '')) {
      return send(res, 403, 'text/plain', 'Forbidden')
    }
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, 'text/html; charset=utf-8', DASHBOARD_HTML)
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return send(res, 200, 'application/json', JSON.stringify(snapshot()))
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, {
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
      })
      res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`)
      clients.add(res)
      // Comment pings keep proxies and browsers from closing an idle stream.
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
      req.on('close', () => { clearInterval(ping); clients.delete(res) })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (req.headers['x-devchat-action'] !== '1') {
        return send(res, 403, 'text/plain', 'Forbidden')
      }
      const id = url.searchParams.get('messenger') as MessengerId | null
      if (!id || !messengers.has(id) || !logoutHandler) {
        return send(res, 404, 'text/plain', 'Unknown messenger')
      }
      try {
        await logoutHandler(id)
        return send(res, 200, 'application/json', '{"ok":true}')
      } catch (e) {
        return send(res, 500, 'application/json', JSON.stringify({ error: (e as Error).message }))
      }
    }
    return send(res, 404, 'text/plain', 'Not found')
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => { if (!res.headersSent) send(res, 500, 'text/plain', 'Error') })
  })
  const requested = options.port ?? (Number(process.env['DEVCHAT_UI_PORT']) || 3000)
  const port = await listen(server, requested)
  const url = `http://localhost:${port}`

  if (options.open ?? !process.env['CI']) {
    openInBrowser(url)
  }

  return {
    close: () => new Promise(resolve => {
      for (const res of clients) res.end()
      clients.clear()
      server.close(() => resolve())
    }),
    onLogout: handler => { logoutHandler = handler },
    pushMessage: entry => {
      feed.unshift(entry)
      feed.length = Math.min(feed.length, feedSize)
      const m = [ ...messengers.values() ].find(s => s.label === entry.messenger)
      if (m) {
        if (entry.self) m.sent++
        else m.received++
      }
      broadcast('state', snapshot())
    },
    snapshot,
    update: (id, patch) => {
      const prev = messengers.get(id)
      const next: MessengerState = {
        id,
        label: patch.label ?? prev?.label ?? id,
        received: prev?.received ?? 0,
        sent: prev?.sent ?? 0,
        since: prev?.since ?? Date.now(),
        status: prev?.status ?? 'starting',
        ...patch,
      }
      if (patch.status && patch.status !== prev?.status) {
        next.since = Date.now()
      }
      if (next.status !== 'scan') delete next.qrSvg
      if (next.status === 'connected') delete next.error
      messengers.set(id, next)
      broadcast('state', snapshot())
    },
    url,
  }
}

/**
 * Subscribe a bot's lifecycle and message events to the dashboard.
 * Never throws into the bot: rendering problems are reported on the card.
 */
export function attachBotToDashboard (
  dashboard: Dashboard,
  bot: DevChatInterface,
  id: MessengerId,
  label: string,
): void {
  dashboard.update(id, { label, status: 'starting' })

  bot.on('scan', (qrcode: string) => {
    try {
      dashboard.update(id, { qrSvg: qrToSvg(qrcode), status: 'scan' })
    } catch (e) {
      dashboard.update(id, { error: (e as Error).message, status: 'error' })
    }
  })
  bot.on('login', user => dashboard.update(id, { status: 'connected', user: user.name() }))
  bot.on('logout', () => dashboard.update(id, { status: 'logged-out', user: undefined }))
  bot.on('error', error => dashboard.update(id, { error: error.message }))
  bot.on('message', async message => {
    try {
      const room = message.room()
      dashboard.pushMessage({
        at: message.date().getTime(),
        chat: room ? await room.topic() : 'Direct message',
        from: message.self() ? 'You (bot)' : message.talker().name(),
        messenger: label,
        self: message.self(),
        text: message.text() || `[${message.type()}]`,
      })
    } catch {
      // A message the driver cannot describe is skipped, not fatal.
    }
  })
}

/** The single-page dashboard. Plain HTML/CSS/JS, no external requests. */
const DASHBOARD_HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>devChat Dashboard</title>
<style>
  :root { --bg:#0b0f14; --bg2:#11171f; --bg3:#18202b; --line:#222c39; --text:#d7dee8; --muted:#8b98a9; --accent:#3ddc97; --warn:#ffcc66; --bad:#ff7a7a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { display:flex; align-items:center; gap:12px; padding:14px 24px; border-bottom:1px solid var(--line); }
  .brand { font:700 20px ui-monospace, Menlo, Consolas, monospace; }
  .brand b { color:var(--accent); }
  .live { margin-left:auto; display:flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; }
  .dot { width:9px; height:9px; border-radius:50%; background:var(--muted); }
  .dot.on { background:var(--accent); box-shadow:0 0 10px var(--accent); }
  main { max-width:1180px; margin:0 auto; padding:24px; display:grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap:20px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin:0 0 12px; }
  .cards { display:grid; gap:16px; }
  .card { background:var(--bg2); border:1px solid var(--line); border-radius:16px; padding:20px; }
  .card-h { display:flex; align-items:center; gap:10px; }
  .card-h h3 { margin:0; font-size:19px; }
  .pill { margin-left:auto; font-size:12px; font-weight:600; padding:4px 10px; border-radius:999px; background:var(--bg3); color:var(--muted); }
  .pill.connected { background:rgba(61,220,151,.15); color:var(--accent); }
  .pill.scan { background:rgba(255,204,102,.15); color:var(--warn); }
  .pill.error, .pill.logged-out { background:rgba(255,122,122,.12); color:var(--bad); }
  .scan { display:grid; grid-template-columns:auto 1fr; gap:22px; align-items:center; margin-top:16px; }
  .qr { background:#fff; border-radius:12px; padding:10px; line-height:0; }
  .qr svg { display:block; max-width:100%; height:auto; }
  ol { margin:0; padding-left:20px; color:var(--text); }
  ol li { margin:6px 0; }
  .muted { color:var(--muted); }
  .stats { display:flex; gap:24px; margin-top:14px; }
  .stat b { display:block; font-size:22px; }
  .stat span { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  .err { margin-top:12px; color:var(--bad); font-size:13px; word-break:break-word; }
  button { margin-top:14px; background:none; border:1px solid var(--line); color:var(--muted); padding:7px 14px; border-radius:8px; cursor:pointer; font:inherit; }
  button:hover { color:var(--text); border-color:var(--muted); }
  .feed { background:var(--bg2); border:1px solid var(--line); border-radius:16px; max-height:calc(100vh - 140px); overflow:auto; }
  .msg { padding:12px 16px; border-bottom:1px solid var(--line); }
  .msg:last-child { border-bottom:none; }
  .meta { display:flex; gap:8px; align-items:baseline; font-size:12px; color:var(--muted); }
  .badge { font-weight:700; color:var(--accent); }
  .who { color:var(--text); font-weight:600; font-size:14px; }
  .text { margin-top:2px; white-space:pre-wrap; word-break:break-word; }
  .msg.self .who { color:var(--accent); }
  .empty { padding:28px; text-align:center; color:var(--muted); }
  footer { text-align:center; color:var(--muted); font-size:12px; padding:0 24px 24px; }
  @media (max-width: 900px) { main { grid-template-columns:1fr; } .scan { grid-template-columns:1fr; justify-items:center; } }
</style>
</head>
<body>
<header>
  <span class="brand">dev<b>Chat</b></span><span class="muted">Dashboard</span>
  <span class="live"><span id="dot" class="dot"></span><span id="conn">Connecting…</span></span>
</header>
<main>
  <section><h2>Messengers</h2><div id="cards" class="cards"></div></section>
  <section><h2>Live messages</h2><div id="feed" class="feed"><div class="empty">Messages will appear here as they arrive.</div></div></section>
</main>
<footer>Runs only on this computer. You can close this tab; the bot keeps running. Stop the bot with Ctrl+C in the terminal.</footer>
<script>
  const STEPS = {
    WhatsApp: ['Open WhatsApp on your phone', 'Tap <b>Settings</b> (iPhone) or <b>⋮</b> (Android) → <b>Linked devices</b>', 'Tap <b>Link a device</b> and point your phone at this code'],
    WeChat: ['Open WeChat on your phone', 'Tap <b>+</b> → <b>Scan</b>', 'Point your phone at this code and confirm the login'],
  }
  const LABEL = { starting: 'Starting…', scan: 'Scan to log in', connected: 'Connected', 'logged-out': 'Logged out', error: 'Problem' }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
  const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s/60) + ' min ago' : Math.floor(s/3600) + ' h ago' }

  function card (m) {
    let body = ''
    if (m.status === 'scan' && m.qrSvg) {
      const steps = (STEPS[m.label] || []).map(s => '<li>' + s + '</li>').join('')
      body = '<div class="scan"><div class="qr">' + m.qrSvg + '</div><div><ol>' + steps + '</ol><p class="muted">The code refreshes by itself. Keep this page open until it says Connected.</p></div></div>'
    } else if (m.status === 'connected') {
      body = '<p class="muted" style="margin:10px 0 0">Logged in as <b style="color:var(--text)">' + esc(m.user) + '</b> · since ' + ago(m.since) + '</p>'
        + '<div class="stats"><div class="stat"><b>' + m.received + '</b><span>received</span></div><div class="stat"><b>' + m.sent + '</b><span>sent</span></div></div>'
        + '<button data-logout="' + esc(m.id) + '">Log out of ' + esc(m.label) + '</button>'
    } else if (m.status === 'starting') {
      body = '<p class="muted" style="margin:10px 0 0">Starting ' + esc(m.label) + '. The login code appears here in a few seconds.</p>'
    } else if (m.status === 'logged-out') {
      body = '<p class="muted" style="margin:10px 0 0">Logged out. A new login code will appear shortly.</p>'
    }
    const err = m.error && m.status !== 'connected' ? '<div class="err">' + esc(m.error) + '</div>' : ''
    return '<div class="card"><div class="card-h"><h3>' + esc(m.label) + '</h3><span class="pill ' + m.status + '">' + (LABEL[m.status] || m.status) + '</span></div>' + body + err + '</div>'
  }

  function renderState (s) {
    document.getElementById('cards').innerHTML = s.messengers.map(card).join('') || '<div class="card muted">No messenger configured. Run npm run setup.</div>'
    const scanning = s.messengers.find(m => m.status === 'scan')
    document.title = scanning ? 'Scan to log in · devChat' : 'devChat Dashboard'
  }

  function msgHtml (e) {
    const t = new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return '<div class="msg' + (e.self ? ' self' : '') + '"><div class="meta"><span class="badge">' + esc(e.messenger) + '</span><span>' + esc(e.chat) + '</span><span style="margin-left:auto">' + t + '</span></div>'
      + '<div class="who">' + esc(e.from) + '</div><div class="text">' + esc(e.text) + '</div></div>'
  }

  function renderFeed (entries) {
    document.getElementById('feed').innerHTML = entries.length ? entries.map(msgHtml).join('') : '<div class="empty">Messages will appear here as they arrive.</div>'
  }

  document.addEventListener('click', async ev => {
    const id = ev.target?.dataset?.logout
    if (!id || !confirm('Log the bot out of ' + id + '? You will need to scan a new code.')) return
    await fetch('/api/logout?messenger=' + encodeURIComponent(id), { method: 'POST', headers: { 'X-DevChat-Action': '1' } })
  })

  function connect () {
    const es = new EventSource('/api/events')
    es.addEventListener('open', () => { document.getElementById('dot').className = 'dot on'; document.getElementById('conn').textContent = 'Live' })
    es.addEventListener('state', ev => { const s = JSON.parse(ev.data); renderState(s); renderFeed(s.feed) })
    es.addEventListener('error', () => { document.getElementById('dot').className = 'dot'; document.getElementById('conn').textContent = 'Bot stopped? Reconnecting…' })
  }
  connect()
  setInterval(() => fetch('/api/state').then(r => r.json()).then(renderState).catch(() => {}), 30000)
</script>
</body>
</html>`
