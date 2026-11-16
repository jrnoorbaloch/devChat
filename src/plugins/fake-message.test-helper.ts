/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Test-only fake implementing `PluginMessage`, shared by the plugin tests.
 * Not exported from the package; it records every `say()` call in `replies`.
 */
import type { Sayable } from '../sayable/mod.ts'
import type { PluginMessage } from './types.ts'

export interface FakeMessage extends PluginMessage {
  replies: Sayable[]
}

export function fakeMessage (
  text: string,
  opts: { self?: boolean, talkerId?: string, roomId?: string, mentioned?: boolean } = {},
): FakeMessage {
  const replies: Sayable[] = []
  return {
    mentionSelf: async () => !!opts.mentioned,
    replies,
    room: () => (opts.roomId ? { id: opts.roomId } : undefined),
    say: async (s: Sayable) => { replies.push(s) },
    self: () => !!opts.self,
    talker: () => ({ id: opts.talkerId ?? 'user-1' }),
    text: () => text,
  }
}
