/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Messenger registry: the single place that maps the friendly messenger names
 * users pick (`wechat`, `whatsapp`) to the puppet (driver) npm package that
 * implements them and to how that package is installed.
 *
 * Why it exists: users should never need to know driver package names. The
 * setup wizard (`setup/init.ts`), the multi-bot runner (`setup/runner.ts`) and
 * puppet resolution in `config.ts` / `puppet-mixin.ts` all read from here, so
 * adding a messenger means adding one entry.
 *
 * Boundaries: pure data and pure functions, no I/O and no imports, so it can
 * be imported from anywhere (including `config.ts`) without cycles.
 */

/** Messengers devChat can set up for you. */
export type MessengerId = 'wechat' | 'whatsapp'

/** Everything devChat needs to know to install and run one messenger. */
export interface MessengerInfo {
  id: MessengerId
  /** Human-readable name, e.g. `WhatsApp`. */
  label: string
  /** npm package name of the puppet (driver) that talks to this messenger. */
  puppet: string
  /**
   * npm install spec. `undefined` means the driver already ships as a devChat
   * dependency, so nothing extra needs to be installed.
   */
  installSpec?: string
  /** Short facts shown to the user before installing. */
  notes: string[]
}

/**
 * Registered messengers.
 *
 * WhatsApp pin: 1.19.16 is the newest release of the WhatsApp driver that is
 * compatible with devChat's puppet API. Its `@juzi/whatsapp-web.js` range
 * (`^1.16.14`) resolves to the currently maintained WhatsApp Web client, which
 * is what keeps logins working; the older `latest` tag pins a 2022 client.
 */
export const MESSENGERS: Readonly<Record<MessengerId, MessengerInfo>> = Object.freeze({
  wechat: {
    id: 'wechat',
    label: 'WeChat',
    notes: [ 'Included with devChat. Nothing extra to download.' ],
    puppet: 'wechaty-puppet-wechat4u',
  },
  whatsapp: {
    id: 'whatsapp',
    installSpec: 'wechaty-puppet-whatsapp@1.19.16',
    label: 'WhatsApp',
    notes: [
      'Downloads a headless Chrome browser (about 150-200 MB) the first time.',
      'Uses WhatsApp Web, not the official WhatsApp Business API. Use a test number; automated accounts can be restricted by WhatsApp.',
    ],
    puppet: 'wechaty-puppet-whatsapp',
  },
})

/** All messenger ids, in menu order. */
export const MESSENGER_IDS: readonly MessengerId[] = Object.freeze([ 'wechat', 'whatsapp' ])

/** Type guard for {@link MessengerId}. */
export function isMessengerId (value: unknown): value is MessengerId {
  return typeof value === 'string' && (MESSENGER_IDS as readonly string[]).includes(value)
}

/**
 * Parse a user's messenger answer from the wizard, a CLI flag or the
 * `DEVCHAT_MESSENGERS` variable.
 *
 * Accepts menu numbers (`1` WeChat, `2` WhatsApp, `3` both), names
 * (`wechat`, `whatsapp`, `weixin`, `wa`), `both` / `all`, and comma or space
 * separated lists. Matching is case-insensitive.
 *
 * @returns unique ids in menu order, or `undefined` when the answer is empty
 *          or contains anything unrecognised (so callers can ask again).
 */
export function parseMessengerChoice (input: string): MessengerId[] | undefined {
  const tokens = input.toLowerCase().split(/[\s,+&/]+|\band\b/).map(t => t.trim()).filter(Boolean)
  if (tokens.length === 0) {
    return undefined
  }
  const picked = new Set<MessengerId>()
  for (const token of tokens) {
    switch (token) {
      case '1': case 'wechat': case 'weixin': case 'wx':
        picked.add('wechat')
        break
      case '2': case 'whatsapp': case 'wa':
        picked.add('whatsapp')
        break
      case '3': case 'both': case 'all':
        MESSENGER_IDS.forEach(id => picked.add(id))
        break
      default:
        return undefined
    }
  }
  return MESSENGER_IDS.filter(id => picked.has(id))
}

/**
 * Translate a friendly messenger name into its puppet package name.
 *
 * `'whatsapp'` -> `'wechaty-puppet-whatsapp'`. Anything that is not a
 * registered messenger id (for example a full package name) is returned
 * unchanged, so this is safe to call on every user-supplied puppet name.
 */
export function resolvePuppetAlias (name: string): string {
  const key = name.trim().toLowerCase()
  return isMessengerId(key) ? MESSENGERS[key].puppet : name
}
