# zulip-moltbot

A robust Zulip integration for [Clawdbot](https://github.com/clawdbot/clawdbot) / Moltbot — full bidirectional communication with persona routing, reactions, and topic-aware messaging.

## Why Zulip?

Zulip's topic model makes it uniquely powerful for structured AI agent work:
- **Topics are first-class** — every message belongs to a topic, enabling persistent workspaces
- **Open source** — self-hostable for privacy
- **Generous API limits** — no rate limit hell
- **Email-like threading** — topics are long-lived, not ephemeral

## Feature Plan

### Tier 1: Core (must-have)

- **Bidirectional messages** — send/receive in streams, topics, and DMs via Clawdbot's native `message` tool
- **Topic-aware routing** — messages route to the right agent/persona based on stream + topic
- **Reactions** — read, add, remove; multiple per message
- **Message history** — fetch recent messages for context (backfill)
- **Edit & delete** — full message lifecycle
- **File/image support** — send and receive attachments

### Tier 2: Rich Integration

- **Persona routing** — map streams to personas with per-persona avatar, voice, and style rules
- **Search** — query message history across streams/topics
- **Stream/topic management** — create, list, archive, subscribe
- **User context** — sender name, email, role, presence (online/idle/offline)
- **Typing indicators** — show when composing

### Tier 3: Zulip-Specific

- **Topic lifecycle** — resolve/unresolve topics
- **Message starring** — flag important messages
- **Muted topics** — respect mute preferences
- **Linkifiers** — custom URL patterns
- **User groups** — permission-aware behavior

### Tier 4: Infrastructure

- **Real-time events** — long-polling with automatic reconnection
- **Rate limiting** — respect API limits, queue outbound messages
- **Multi-org support** — connect to multiple Zulip instances
- **Webhook mode** — alternative to polling for lighter setups
- **Config schema** — declarative routing, style rules, and filters

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Clawdbot Gateway                       │
├──────────────────────────────────────────────────────────┤
│  zulip channel plugin                                     │
│  ├── inbound: poll events → emit messages                │
│  ├── outbound: sendText, sendMedia, react, edit, delete  │
│  └── config: multi-account, persona routing              │
├──────────────────────────────────────────────────────────┤
│  zulip agent tools                                        │
│  ├── zulip_send    (stream/DM messages)                  │
│  ├── zulip_read    (fetch history, search)               │
│  ├── zulip_react   (add/remove reactions)                │
│  ├── zulip_streams (list, create, archive, subscribe)    │
│  ├── zulip_topics  (list, create, resolve)               │
│  ├── zulip_users   (list, info, presence)                │
│  ├── zulip_upload  (files/images)                        │
│  └── zulip_edit    (edit/delete messages)                │
└──────────────────────────────────────────────────────────┘
```

## Configuration Example

```yaml
zulip:
  accounts:
    - id: default
      email: bot@your-org.zulipchat.com
      apiKey: ${ZULIP_API_KEY}
      site: https://your-org.zulipchat.com

  routing:
    streams:
      mentor:
        persona: mentor
        style: concise     # 1-3 sentences, questions over statements
      creative:
        persona: muse
        style: expressive  # vivid, playful
      general:
        persona: default
        style: balanced

  events:
    pollIntervalMs: 1000
    reconnectDelayMs: 5000
    
  messages:
    defaultStyle: short   # short | balanced | detailed
    maxLength: 500        # characters, 0 = unlimited
```

## Zulip API Reference

- [REST API docs](https://zulip.com/api/)
- [Real-time events](https://zulip.com/api/real-time-events)
- [Message formatting](https://zulip.com/help/format-your-message-using-markdown)
- [Incoming webhooks](https://zulip.com/api/incoming-webhooks-overview)

## License

MIT
