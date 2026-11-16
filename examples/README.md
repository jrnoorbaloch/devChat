# devChat examples

| Example | What it shows | Run |
| --- | --- | --- |
| [`ding-dong-bot.ts`](./ding-dong-bot.ts) | Minimal bot: scan QR, log in, reply `dong` to `ding` | `npm run demo` |
| [`command-bot.ts`](./command-bot.ts) | Built-in `CommandRouter` + `AutoReply` plugins with rate limiting | `npm run demo:commands` |
| [`video-post.ts`](./video-post.ts) | Posting video content through the Post API | `node examples/video-post.ts` |

Choose a puppet (IM provider) with `DEVCHAT_PUPPET`, for example:

```sh
DEVCHAT_PUPPET=wechaty-puppet-wechat4u npm run demo:commands
```

devChat is API-compatible with Wechaty, so the
[Wechaty getting-started examples](https://github.com/wechaty/getting-started/tree/main/examples)
also work after replacing the `wechaty` import with `devchat`.
