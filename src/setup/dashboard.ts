/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Local dashboard: a small web app that `npm start` opens in the browser.
 *
 * Why it exists: logging in by scanning a QR code in a terminal is fragile,
 * and watching a bot through logs is hard. The dashboard shows each
 * messenger's live status and login QR code, then works like a chat client:
 * a list of conversations, a chat window per conversation, and a box to send
 * messages as the bot.
 *
 * Security model (keep it):
 * - listens on 127.0.0.1 only, never on the network;
 * - rejects requests whose Host header is not localhost (DNS rebinding);
 * - sends no CORS headers, so other websites cannot read the API or stream;
 * - state-changing requests (send, logout) are POST and need the
 *   `X-DevChat-Action` header, which browsers cannot send cross-site without a
 *   CORS preflight that this server refuses.
 * QR codes are rendered locally (`qr-svg.ts`); conversations live in memory
 * only and are gone when the bot stops.
 *
 * Boundaries: owns the HTTP server, the in-memory state and the page. It does
 * not own bots; `attachBotToDashboard()` subscribes to a bot's events and
 * registers how to send for that messenger, and the runner (`runner.ts`)
 * decides when to start the dashboard.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import spawn from 'cross-spawn'
import * as PUPPET from 'wechaty-puppet'

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

/** One message as shown in the chat window and the "all messages" view. */
export interface FeedEntry {
  at: number
  /** Messenger label, e.g. `WhatsApp`. */
  messenger: string
  /** Chat name (group topic or the other person's name). */
  chat: string
  from: string
  text: string
  self: boolean
  /** Conversation key (`<messenger>:<room|contact>:<id>`). Absent when unknown. */
  chatKey?: string
}

/** One row of the chat list. */
export interface ChatSummary {
  key: string
  messengerId: MessengerId
  messenger: string
  chatId: string
  isRoom: boolean
  name: string
  lastText: string
  lastAt: number
}

/** Sends `text` to a chat of one messenger. */
export type ChatSender = (chatId: string, isRoom: boolean, text: string) => Promise<void>

/** Options for {@link startDashboard}. */
export interface DashboardOptions {
  /** First port to try. Default `DEVCHAT_UI_PORT` or 3000; the next 20 are tried if busy. Use 0 for any free port. */
  port?: number
  /** Open the dashboard in the default browser. Default `true` (not in CI). */
  open?: boolean
  /** Messages kept in the "all messages" view. Default 100. */
  feedSize?: number
  /** Messages kept per conversation. Default 200. */
  chatHistorySize?: number
  /** Conversations kept; the least recently active are dropped. Default 300. */
  maxChats?: number
}

/** Handle returned by {@link startDashboard}. */
export interface Dashboard {
  url: string
  /** Create or update a messenger card. */
  update: (id: MessengerId, patch: Partial<MessengerState> & { label?: string }) => void
  /**
   * Record a message. With `chat` it is also filed under that conversation
   * (creating it if needed) so it shows in the chat list and chat window.
   */
  pushMessage: (entry: FeedEntry, chat?: { messengerId: MessengerId, chatId: string, isRoom: boolean }) => void
  /** Register what the Logout button does for a messenger. */
  onLogout: (handler: (id: MessengerId) => Promise<void>) => void
  /** Register how to send messages for a messenger. */
  registerSender: (id: MessengerId, sender: ChatSender) => void
  /** Send a message from the dashboard (also used by the HTTP API). */
  send: (chatKey: string, text: string) => Promise<void>
  /** Current snapshot (also served at `/api/state`). */
  snapshot: () => { messengers: MessengerState[], feed: FeedEntry[], chats: ChatSummary[] }
  /** Message history of one conversation, oldest first. */
  history: (chatKey: string) => FeedEntry[] | undefined
  close: () => Promise<void>
}

/** Longest message the dashboard will send (WhatsApp's own limit is 65,536). */
export const MAX_SEND_LENGTH = 4096

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/** Build the conversation key used by the API and the page. */
export function chatKeyOf (messengerId: MessengerId, isRoom: boolean, chatId: string): string {
  return `${messengerId}:${isRoom ? 'room' : 'contact'}:${chatId}`
}

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

/** Read a small JSON request body (limit 64 KB). */
function readJson (req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > 64 * 1024) {
        reject(new Error('Request too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Start the dashboard server.
 *
 * @returns a handle to feed it state; resolves once it is listening.
 */
export async function startDashboard (options: DashboardOptions = {}): Promise<Dashboard> {
  const feedSize    = options.feedSize ?? 100
  const historySize = options.chatHistorySize ?? 200
  const maxChats    = options.maxChats ?? 300

  const messengers = new Map<MessengerId, MessengerState>()
  const feed: FeedEntry[] = []
  const chats      = new Map<string, { summary: ChatSummary, messages: FeedEntry[] }>()
  const senders    = new Map<MessengerId, ChatSender>()
  /** Messages sent from the dashboard, to drop the driver's echo of them. */
  const echoes: { key: string, text: string, at: number }[] = []
  const clients    = new Set<ServerResponse>()
  let logoutHandler: ((id: MessengerId) => Promise<void>) | undefined

  const chatList = () => [ ...chats.values() ].map(c => c.summary).sort((a, b) => b.lastAt - a.lastAt)
  const snapshot = () => ({ chats: chatList(), feed: [ ...feed ], messengers: [ ...messengers.values() ] })

  const broadcast = (event: string, data: unknown) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of clients) {
      res.write(payload)
    }
  }

  /** File an entry: feed, counters, conversation; then tell the browsers. */
  const record = (entry: FeedEntry, chat?: { messengerId: MessengerId, chatId: string, isRoom: boolean }) => {
    if (chat) {
      entry.chatKey = chatKeyOf(chat.messengerId, chat.isRoom, chat.chatId)
      let c = chats.get(entry.chatKey)
      if (!c) {
        c = {
          messages: [],
          summary: { chatId: chat.chatId, isRoom: chat.isRoom, key: entry.chatKey, lastAt: 0, lastText: '', messenger: entry.messenger, messengerId: chat.messengerId, name: entry.chat },
        }
        chats.set(entry.chatKey, c)
        if (chats.size > maxChats) {
          const oldest = chatList().at(-1)
          if (oldest) chats.delete(oldest.key)
        }
      }
      c.messages.push(entry)
      if (c.messages.length > historySize) c.messages.splice(0, c.messages.length - historySize)
      c.summary.lastAt = entry.at
      c.summary.lastText = entry.text
      if (!entry.self) c.summary.name = entry.chat
    }
    feed.unshift(entry)
    feed.length = Math.min(feed.length, feedSize)
    const m = [ ...messengers.values() ].find(s => s.label === entry.messenger)
    if (m) {
      if (entry.self) m.sent++
      else m.received++
    }
    broadcast('message', { entry, summary: entry.chatKey ? chats.get(entry.chatKey)?.summary : undefined })
    broadcast('counts', [ ...messengers.values() ].map(s => ({ id: s.id, received: s.received, sent: s.sent })))
  }

  const sendMessage = async (chatKey: string, rawText: string) => {
    const text = rawText.trim()
    if (!text) throw new Error('Message is empty')
    if (text.length > MAX_SEND_LENGTH) throw new Error(`Message is longer than ${MAX_SEND_LENGTH} characters`)
    const chat = chats.get(chatKey)
    if (!chat) throw new Error('Unknown chat')
    const sender = senders.get(chat.summary.messengerId)
    if (!sender) throw new Error(`${chat.summary.messenger} is not connected`)
    await sender(chat.summary.chatId, chat.summary.isRoom, text)
    // Show it right away; the driver's own copy of it is dropped as an echo.
    echoes.push({ at: Date.now(), key: chatKey, text })
    record({ at: Date.now(), chat: chat.summary.name, from: 'You (bot)', messenger: chat.summary.messenger, self: true, text },
      { chatId: chat.summary.chatId, isRoom: chat.summary.isRoom, messengerId: chat.summary.messengerId })
  }

  const send = (res: ServerResponse, status: number, type: string, body: string) => {
    res.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'self'",
      'Content-Type': type,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    })
    res.end(body)
  }
  const json = (res: ServerResponse, status: number, data: unknown) => send(res, status, 'application/json', JSON.stringify(data))

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!LOCAL_HOST.test(req.headers.host ?? '')) {
      return send(res, 403, 'text/plain', 'Forbidden')
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const isAction = req.method === 'POST' && req.headers['x-devchat-action'] === '1'

    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, 'text/html; charset=utf-8', DASHBOARD_HTML)
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return json(res, 200, snapshot())
    }
    if (req.method === 'GET' && url.pathname === '/api/chat') {
      const c = chats.get(url.searchParams.get('key') ?? '')
      return c ? json(res, 200, { messages: c.messages, summary: c.summary }) : json(res, 404, { error: 'Unknown chat' })
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
    if (req.method === 'POST' && (url.pathname === '/api/logout' || url.pathname === '/api/send')) {
      if (!isAction) {
        return send(res, 403, 'text/plain', 'Forbidden')
      }
      if (url.pathname === '/api/logout') {
        const id = url.searchParams.get('messenger') as MessengerId | null
        if (!id || !messengers.has(id) || !logoutHandler) {
          return send(res, 404, 'text/plain', 'Unknown messenger')
        }
        try {
          await logoutHandler(id)
          return json(res, 200, { ok: true })
        } catch (e) {
          return json(res, 500, { error: (e as Error).message })
        }
      }
      try {
        const body = await readJson(req) as { key?: unknown, text?: unknown }
        if (typeof body.key !== 'string' || typeof body.text !== 'string') {
          return json(res, 400, { error: 'Expected { key, text }' })
        }
        await sendMessage(body.key, body.text)
        return json(res, 200, { ok: true })
      } catch (e) {
        return json(res, 400, { error: (e as Error).message })
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
    history: key => chats.get(key)?.messages.slice(),
    onLogout: handler => { logoutHandler = handler },
    pushMessage: (entry, chat) => {
      if (entry.self && chat) {
        // Drop the driver's copy of a message the dashboard already showed.
        const key = chatKeyOf(chat.messengerId, chat.isRoom, chat.chatId)
        const now = Date.now()
        while (echoes.length && now - echoes[0]!.at > 30_000) echoes.shift()
        const i = echoes.findIndex(e => e.key === key && e.text === entry.text)
        if (i >= 0) {
          echoes.splice(i, 1)
          return
        }
      }
      record(entry, chat)
    },
    registerSender: (id, sender) => { senders.set(id, sender) },
    send: sendMessage,
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
      broadcast('messengers', [ ...messengers.values() ])
    },
    url,
  }
}

/**
 * Subscribe a bot's lifecycle and message events to the dashboard, and let
 * the dashboard send messages through it. Never throws into the bot:
 * rendering problems are reported on the card or the message is skipped.
 */
export function attachBotToDashboard (
  dashboard: Dashboard,
  bot: DevChatInterface,
  id: MessengerId,
  label: string,
): void {
  dashboard.update(id, { label, status: 'starting' })

  dashboard.registerSender(id, async (chatId, isRoom, text) => {
    if (isRoom) {
      const room = await bot.Room.find({ id: chatId })
      if (!room) throw new Error('Group not found')
      await room.say(text)
    } else {
      const contact = await bot.Contact.find({ id: chatId })
      if (!contact) throw new Error('Contact not found')
      await contact.say(text)
    }
  })

  bot.on('scan', (qrcode: string) => {
    try {
      // 260px fits the sidebar without scaling, keeping whole-pixel modules.
      dashboard.update(id, { qrSvg: qrToSvg(qrcode, 260), status: 'scan' })
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
      const self = message.self()
      // In a direct chat the conversation partner is the listener of our own
      // messages and the talker of everyone else's.
      const partner = room ? undefined : self ? message.listener() : message.talker()
      const type = message.type()
      const text = message.text() || `[${PUPPET.types.Message[type] ?? 'Message'}]`
      const chatName = room ? await room.topic() : partner?.name() || 'Direct message'
      dashboard.pushMessage({
        at: message.date().getTime(),
        chat: chatName,
        from: self ? 'You (bot)' : message.talker().name(),
        messenger: label,
        self,
        text,
      }, room
        ? { chatId: room.id, isRoom: true, messengerId: id }
        : partner ? { chatId: partner.id, isRoom: false, messengerId: id } : undefined)
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
<title>devChat</title>
<style>
  :root { --bg:#0b0f14; --bg2:#11171f; --bg3:#18202b; --bg4:#1f2935; --line:#222c39; --text:#d7dee8; --muted:#8b98a9; --accent:#3ddc97; --accent-ink:#04140c; --out:#123a2a; --warn:#ffcc66; --bad:#ff7a7a; }
  * { box-sizing:border-box; }
  [hidden] { display:none !important; }
  html, body { height:100%; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; display:flex; flex-direction:column; }
  button, input, textarea { font:inherit; color:inherit; }
  header { display:flex; align-items:center; gap:12px; padding:10px 18px; border-bottom:1px solid var(--line); flex:none; }
  .brand { font:700 19px ui-monospace, Menlo, Consolas, monospace; }
  .brand b { color:var(--accent); }
  .live { margin-left:auto; display:flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; }
  .dot { width:9px; height:9px; border-radius:50%; background:var(--muted); flex:none; }
  .dot.on { background:var(--accent); box-shadow:0 0 10px var(--accent); }
  .dot.scan { background:var(--warn); }
  .dot.bad { background:var(--bad); }
  .app { flex:1; min-height:0; display:grid; grid-template-columns:360px minmax(0,1fr); }
  aside { border-right:1px solid var(--line); display:flex; flex-direction:column; min-height:0; }
  .accounts { padding:12px; display:grid; gap:10px; border-bottom:1px solid var(--line); flex:none; max-height:72vh; overflow:auto; }
  .acct { background:var(--bg2); border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
  .acct-h { display:flex; align-items:center; gap:8px; }
  .acct-h b { font-size:15px; }
  .acct-h .who { color:var(--muted); font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pill { margin-left:auto; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; background:var(--bg3); color:var(--muted); white-space:nowrap; }
  .pill.connected { background:rgba(61,220,151,.15); color:var(--accent); }
  .pill.scan { background:rgba(255,204,102,.15); color:var(--warn); }
  .pill.error, .pill.logged-out { background:rgba(255,122,122,.12); color:var(--bad); }
  .qr { background:#fff; border-radius:10px; padding:8px; line-height:0; margin:12px auto 8px; width:max-content; max-width:100%; }
  .qr svg { display:block; max-width:100%; height:auto; }
  .acct ol { margin:6px 0 0; padding-left:18px; font-size:13px; }
  .acct .note { color:var(--muted); font-size:13px; margin:8px 0 0; }
  .acct .row { display:flex; align-items:center; gap:14px; margin-top:6px; color:var(--muted); font-size:12px; }
  .link { background:none; border:none; color:var(--muted); cursor:pointer; padding:0; margin-left:auto; text-decoration:underline; font-size:12px; }
  .err { margin-top:8px; color:var(--bad); font-size:12px; word-break:break-word; }
  .search { padding:10px 12px; border-bottom:1px solid var(--line); flex:none; }
  .search input { width:100%; background:var(--bg2); border:1px solid var(--line); border-radius:9px; padding:8px 12px; outline:none; }
  .search input:focus { border-color:var(--accent); }
  .chats { flex:1; overflow:auto; min-height:0; }
  .chat-row { display:flex; gap:10px; padding:11px 14px; border-bottom:1px solid var(--line); cursor:pointer; align-items:center; }
  .chat-row:hover { background:var(--bg2); }
  .chat-row.active { background:var(--bg3); }
  .avatar { width:38px; height:38px; border-radius:50%; background:var(--bg4); display:grid; place-items:center; font-weight:700; color:var(--accent); flex:none; }
  .chat-main { min-width:0; flex:1; }
  .chat-top { display:flex; gap:8px; align-items:baseline; }
  .chat-name { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chat-time { margin-left:auto; color:var(--muted); font-size:11px; flex:none; }
  .chat-last { color:var(--muted); font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; gap:6px; }
  .tag { font-size:10px; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:.05em; flex:none; }
  .unread { margin-left:auto; background:var(--accent); color:var(--accent-ink); border-radius:999px; font-size:11px; font-weight:700; padding:1px 7px; flex:none; }
  .empty { padding:26px; text-align:center; color:var(--muted); font-size:14px; }
  main { display:flex; flex-direction:column; min-height:0; min-width:0; }
  .conv-h { display:flex; align-items:center; gap:10px; padding:10px 18px; border-bottom:1px solid var(--line); flex:none; min-height:59px; }
  .conv-h .sub { color:var(--muted); font-size:12px; }
  .back { display:none; background:none; border:1px solid var(--line); border-radius:8px; padding:3px 10px; cursor:pointer; }
  .msgs { flex:1; overflow:auto; padding:16px 18px; display:flex; flex-direction:column; gap:6px; min-height:0; }
  .bubble { max-width:min(78%, 640px); padding:7px 11px 5px; border-radius:12px; background:var(--bg3); align-self:flex-start; word-break:break-word; white-space:pre-wrap; }
  .bubble.me { align-self:flex-end; background:var(--out); }
  .bubble .by { font-size:12px; font-weight:700; color:var(--accent); margin-bottom:1px; }
  .bubble .t { font-size:10.5px; color:var(--muted); text-align:right; margin-top:2px; }
  .bubble .via { font-size:11px; color:var(--muted); margin-bottom:2px; }
  .day { align-self:center; font-size:11px; color:var(--muted); background:var(--bg2); padding:2px 10px; border-radius:999px; margin:6px 0; }
  form.composer { display:flex; gap:10px; padding:12px 18px; border-top:1px solid var(--line); flex:none; align-items:flex-end; }
  form.composer textarea { flex:1; resize:none; background:var(--bg2); border:1px solid var(--line); border-radius:12px; padding:10px 14px; max-height:140px; outline:none; }
  form.composer textarea:focus { border-color:var(--accent); }
  form.composer button { background:var(--accent); color:var(--accent-ink); border:none; border-radius:12px; padding:10px 18px; font-weight:700; cursor:pointer; }
  form.composer button:disabled { opacity:.5; cursor:default; }
  .send-err { color:var(--bad); font-size:12px; padding:0 18px 8px; }
  .hint { color:var(--muted); font-size:12px; padding:0 18px 10px; }
  @media (max-width: 860px) {
    .app { grid-template-columns:1fr; }
    body.in-chat aside { display:none; }
    body:not(.in-chat) main { display:none; }
    .back { display:inline-block; }
  }
</style>
</head>
<body>
<header>
  <span class="brand">dev<b>Chat</b></span>
  <span class="live"><span id="dot" class="dot"></span><span id="conn">Connecting…</span></span>
</header>
<div class="app">
  <aside>
    <div id="accounts" class="accounts"></div>
    <div class="search"><input id="q" type="search" placeholder="Search chats" autocomplete="off"></div>
    <div id="chats" class="chats"></div>
  </aside>
  <main>
    <div class="conv-h"><button class="back" id="back" type="button">←</button><div><div id="conv-title" style="font-weight:700">All messages</div><div id="conv-sub" class="sub">Pick a chat on the left to read and reply</div></div></div>
    <div id="msgs" class="msgs"></div>
    <div id="send-err" class="send-err" hidden></div>
    <form id="composer" class="composer" hidden>
      <textarea id="text" rows="1" placeholder="Type a message" maxlength="4096"></textarea>
      <button id="send" type="submit">Send</button>
    </form>
    <div id="hint" class="hint" hidden>Enter to send · Shift+Enter for a new line · sent as the bot account</div>
  </main>
</div>
<script>
  const STEPS = {
    WhatsApp: ['Open WhatsApp on your phone', 'Tap <b>Settings</b> (iPhone) or <b>⋮</b> (Android) → <b>Linked devices</b>', 'Tap <b>Link a device</b> and scan this code'],
    WeChat: ['Open WeChat on your phone', 'Tap <b>+</b> → <b>Scan</b>', 'Scan this code and confirm the login'],
  }
  const LABEL = { starting: 'Starting…', scan: 'Scan to log in', connected: 'Connected', 'logged-out': 'Logged out', error: 'Problem' }
  const $ = id => document.getElementById(id)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
  const hhmm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const when = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? hhmm(t) : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) }
  const initials = name => (String(name || '?').trim().match(/\\p{L}|\\p{N}/u) || ['?'])[0].toUpperCase()

  const S = { messengers: [], chats: new Map(), feed: [], open: null, openMessages: [], unread: new Map(), q: '' }

  // ---- accounts ----
  function renderAccounts () {
    $('accounts').innerHTML = S.messengers.map(m => {
      let body = ''
      if (m.status === 'scan' && m.qrSvg) {
        body = '<div class="qr">' + m.qrSvg + '</div><ol>' + (STEPS[m.label] || []).map(s => '<li>' + s + '</li>').join('') + '</ol><p class="note">The code refreshes by itself.</p>'
      } else if (m.status === 'connected') {
        body = '<div class="row"><span>' + m.received + ' received</span><span>' + m.sent + ' sent</span><button class="link" data-logout="' + esc(m.id) + '">Log out</button></div>'
      } else if (m.status === 'starting') {
        body = '<p class="note">Starting. The login code appears here in a few seconds.</p>'
      } else if (m.status === 'logged-out') {
        body = '<p class="note">Logged out. A new login code will appear shortly.</p>'
      }
      const err = m.error && m.status !== 'connected' ? '<div class="err">' + esc(m.error) + '</div>' : ''
      const who = m.status === 'connected' && m.user ? '<span class="who">· ' + esc(m.user) + '</span>' : ''
      return '<div class="acct"><div class="acct-h"><b>' + esc(m.label) + '</b>' + who + '<span class="pill ' + m.status + '">' + (LABEL[m.status] || m.status) + '</span></div>' + body + err + '</div>'
    }).join('') || '<div class="empty">No messenger configured. Run <code>npm run setup</code>.</div>'
    const ok = S.messengers.length && S.messengers.every(m => m.status === 'connected')
    const scanning = S.messengers.some(m => m.status === 'scan')
    $('dot').className = 'dot ' + (ok ? 'on' : scanning ? 'scan' : S.messengers.some(m => m.status === 'error') ? 'bad' : '')
    $('conn').textContent = ok ? 'Connected' : scanning ? 'Waiting for QR scan' : 'Live'
    document.title = scanning ? 'Scan to log in · devChat' : 'devChat'
  }

  // ---- chat list ----
  function renderChats () {
    const q = S.q.toLowerCase()
    const list = [...S.chats.values()].filter(c => !q || c.name.toLowerCase().includes(q)).sort((a, b) => b.lastAt - a.lastAt)
    $('chats').innerHTML = list.length ? list.map(c => {
      const n = S.unread.get(c.key) || 0
      return '<div class="chat-row' + (S.open === c.key ? ' active' : '') + '" data-key="' + esc(c.key) + '"><div class="avatar">' + esc(initials(c.name)) + '</div>'
        + '<div class="chat-main"><div class="chat-top"><span class="chat-name">' + esc(c.name) + '</span><span class="chat-time">' + when(c.lastAt) + '</span></div>'
        + '<div class="chat-last"><span class="tag">' + esc(c.messenger) + (c.isRoom ? ' · group' : '') + '</span><span style="overflow:hidden;text-overflow:ellipsis">' + esc(c.lastText) + '</span>' + (n ? '<span class="unread">' + n + '</span>' : '') + '</div></div></div>'
    }).join('') : '<div class="empty">' + (S.q ? 'No chat matches your search.' : 'Chats appear here when messages arrive.<br>Send the bot a message from another phone to start.') + '</div>'
  }

  // ---- conversation ----
  function bubble (e, showFrom, showVia) {
    return '<div class="bubble' + (e.self ? ' me' : '') + '">'
      + (showVia ? '<div class="via">' + esc(e.messenger) + ' · ' + esc(e.chat) + '</div>' : '')
      + (showFrom && !e.self ? '<div class="by">' + esc(e.from) + '</div>' : '')
      + esc(e.text) + '<div class="t">' + hhmm(e.at) + '</div></div>'
  }
  function renderConversation (keepScroll) {
    const box = $('msgs')
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80
    let html = ''
    if (S.open) {
      const c = S.chats.get(S.open)
      $('conv-title').textContent = c ? c.name : 'Chat'
      $('conv-sub').textContent = c ? c.messenger + (c.isRoom ? ' group' : ' chat') : ''
      let day = ''
      for (const e of S.openMessages) {
        const d = new Date(e.at).toDateString()
        if (d !== day) { day = d; html += '<div class="day">' + new Date(e.at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + '</div>' }
        html += bubble(e, c && c.isRoom, false)
      }
      box.innerHTML = html || '<div class="empty">No messages yet.</div>'
      $('composer').hidden = false; $('hint').hidden = false
    } else {
      $('conv-title').textContent = 'All messages'
      $('conv-sub').textContent = 'Pick a chat on the left to read and reply'
      box.innerHTML = [...S.feed].reverse().map(e => bubble(e, true, true)).join('') || '<div class="empty">Messages from every chat appear here as they arrive.</div>'
      $('composer').hidden = true; $('hint').hidden = true
    }
    if (!keepScroll || nearBottom) box.scrollTop = box.scrollHeight
  }

  async function openChat (key) {
    S.open = key
    S.unread.delete(key)
    document.body.classList.add('in-chat')
    $('send-err').hidden = true
    try {
      const r = await fetch('/api/chat?key=' + encodeURIComponent(key))
      S.openMessages = r.ok ? (await r.json()).messages : []
    } catch { S.openMessages = [] }
    renderChats(); renderConversation(false)
    $('text').focus()
  }

  // ---- events from the bot ----
  function onMessage ({ entry, summary }) {
    S.feed.unshift(entry); S.feed.length = Math.min(S.feed.length, 100)
    if (summary) {
      S.chats.set(summary.key, summary)
      if (entry.chatKey === S.open) S.openMessages.push(entry)
      else if (!entry.self) S.unread.set(summary.key, (S.unread.get(summary.key) || 0) + 1)
    }
    renderChats()
    if (!S.open || entry.chatKey === S.open) renderConversation(true)
  }

  function connect () {
    const es = new EventSource('/api/events')
    es.addEventListener('state', ev => {
      const s = JSON.parse(ev.data)
      S.messengers = s.messengers; S.feed = s.feed
      S.chats = new Map(s.chats.map(c => [c.key, c]))
      renderAccounts(); renderChats()
      if (S.open && S.chats.has(S.open)) openChat(S.open); else { S.open = null; renderConversation(false) }
    })
    es.addEventListener('messengers', ev => { S.messengers = JSON.parse(ev.data); renderAccounts() })
    es.addEventListener('counts', ev => { for (const c of JSON.parse(ev.data)) { const m = S.messengers.find(x => x.id === c.id); if (m) Object.assign(m, c) } renderAccounts() })
    es.addEventListener('message', ev => onMessage(JSON.parse(ev.data)))
    es.addEventListener('error', () => { $('dot').className = 'dot bad'; $('conn').textContent = 'Bot stopped? Reconnecting…' })
  }

  // ---- UI actions ----
  $('chats').addEventListener('click', ev => { const row = ev.target.closest('.chat-row'); if (row) openChat(row.dataset.key) })
  $('q').addEventListener('input', ev => { S.q = ev.target.value; renderChats() })
  $('back').addEventListener('click', () => { S.open = null; document.body.classList.remove('in-chat'); renderChats(); renderConversation(false) })
  $('accounts').addEventListener('click', async ev => {
    const id = ev.target.dataset && ev.target.dataset.logout
    if (!id || !confirm('Log the bot out of ' + id + '? You will need to scan a new code.')) return
    await fetch('/api/logout?messenger=' + encodeURIComponent(id), { method: 'POST', headers: { 'X-DevChat-Action': '1' } })
  })
  const ta = $('text')
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px' })
  ta.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); $('composer').requestSubmit() } })
  $('composer').addEventListener('submit', async ev => {
    ev.preventDefault()
    const text = ta.value.trim()
    if (!text || !S.open) return
    $('send').disabled = true; $('send-err').hidden = true
    try {
      const r = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DevChat-Action': '1' }, body: JSON.stringify({ key: S.open, text }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not send')
      ta.value = ''; ta.style.height = 'auto'
    } catch (e) {
      $('send-err').textContent = 'Not sent: ' + e.message; $('send-err').hidden = false
    } finally {
      $('send').disabled = false; ta.focus()
    }
  })

  connect()
</script>
</body>
</html>`
