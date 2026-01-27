# zulip-moltbot

A Zulip channel plugin for [Moltbot](https://github.com/moltbot/moltbot) — bidirectional messaging with persona routing and topic-aware conversations.

## Why Zulip?

Zulip's topic model makes it uniquely powerful for structured AI agent work:
- **Topics are first-class** — every message belongs to a topic, enabling persistent workspaces
- **Open source** — self-hostable for privacy
- **Generous API limits** — no rate limit hell
- **Email-like threading** — topics are long-lived, not ephemeral

## Status

The plugin loads in Moltbot and implements the core channel plugin contract (config, outbound, actions, gateway). Not yet tested end-to-end.

## Roadmap

### Now: End-to-end validation
- Verify gateway starts and receives Zulip events
- Verify outbound messaging works through Moltbot's `message` tool
- Fix whatever breaks

### Next: Context and personas
- **Message history/backfill** — agent needs recent context to respond well
- **Persona routing** — map streams to personas (the killer feature)

### Later: As needed
- File/image support
- Edit & delete
- Stream/topic management
- Search across streams/topics

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 Moltbot Gateway                  │
├──────────────────────────────────────────────────┤
│  zulip-moltbot channel plugin                    │
│  ├── config: account from ~/.clawdbot/secrets/   │
│  ├── gateway: long-poll event loop               │
│  ├── outbound: sendText, sendMedia               │
│  └── actions: send, react, read, edit, delete    │
└──────────────────────────────────────────────────┘
```

The plugin registers as a Moltbot channel. All messaging goes through Moltbot's native `message` tool via `actions.handleAction` — no separate agent tools needed.

## Setup

1. Add credentials to `~/.clawdbot/secrets/zulip.env`:
   ```
   ZULIP_EMAIL=bot@your-org.zulipchat.com
   ZULIP_API_KEY=your-api-key
   ZULIP_SITE=https://your-org.zulipchat.com
   ```

2. Add the plugin load path:
   ```bash
   clawdbot config set plugins.load.paths '["/path/to/zulip-moltbot"]'
   clawdbot config set plugins.entries.zulip-moltbot.enabled true
   ```

3. Restart the gateway.

## Zulip API Reference

- [REST API docs](https://zulip.com/api/)
- [Real-time events](https://zulip.com/api/real-time-events)
- [Message formatting](https://zulip.com/help/format-your-message-using-markdown)

## License

MIT
