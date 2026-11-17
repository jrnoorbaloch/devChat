# devChat examples

| Example | What it shows | Run |
| --- | --- | --- |
| [`ding-dong-bot.ts`](./ding-dong-bot.ts) | Minimal bot: scan QR, log in, reply `dong` to `ding` | `npm run demo` |
| [`command-bot.ts`](./command-bot.ts) | Built-in `CommandRouter` + `AutoReply` plugins with rate limiting | `npm run demo:commands` |
| [`video-post.ts`](./video-post.ts) | Posting video content through the Post API | `node examples/video-post.ts` |

Choose the messenger with `DEVCHAT_PUPPET`:

```sh
DEVCHAT_PUPPET=whatsapp npm run demo:commands
DEVCHAT_PUPPET=wechat   npm run demo:commands
```

For your own bot, run `npm run setup` once and edit the generated `bot.ts`.
