# Moltbot Channel Plugin Study Notes

Based on reading the Slack plugin (~514 lines) and the plugin registry/discovery system.

## Plugin Interface

A channel plugin is an object with these sections:

### Required
- **`id`** — string identifier (e.g., "slack", "discord", "zulip")
- **`meta`** — label, selectionLabel, docsPath, blurb, aliases
- **`capabilities`** — declares what the channel supports:
  ```js
  { chatTypes: ["direct", "channel", "thread"], reactions: true, threads: true, media: true }
  ```
- **`outbound`** — how to send messages:
  - `deliveryMode`: "direct"
  - `sendText({ to, text, accountId, cfg, replyToId })` → `{ channel, messageId }`
  - `sendMedia({ to, text, mediaUrl, accountId, cfg })` → same
  - `textChunkLimit`: max chars per message

### Account Management
- **`config`** — account resolution:
  - `listAccountIds(cfg)` → string[]
  - `resolveAccount(cfg, accountId)` → account object
  - `defaultAccountId(cfg)` → string
  - `isConfigured(account)` → boolean
  - `resolveAllowFrom({ cfg, accountId })` → allowed sender list

### Actions (the `message` tool)
- **`actions`** — handles the `message` tool calls:
  - `listActions({ cfg })` → ["send", "react", "read", "edit", "delete", "pin", ...]
  - `handleAction({ action, params, cfg, accountId })` → result
  - Each action reads params and delegates to API calls

### Gateway (real-time events)
- **`gateway`** — starts the event loop:
  - `startAccount(ctx)` → starts monitoring (long-poll, websocket, etc.)
  - ctx provides: account, cfg, runtime, abortSignal, log

### Optional
- **`security`** — DM policies, pairing, allowlists
- **`groups`** — mention gating for group chats
- **`threading`** — reply-to modes, thread context
- **`messaging`** — target normalization (how to parse "stream:general" etc.)
- **`directory`** — list peers and groups
- **`status`** — health probes, account snapshots
- **`setup`** — config writing helpers for `clawdbot channels add`
- **`streaming`** — coalesce settings for streaming responses
- **`pairing`** — approval flow for new users
- **`onboarding`** — setup wizard adapter

## Registration

Extensions export a default function that receives an API object:

```js
export default function register(api) {
  api.registerChannel({ plugin: myChannelPlugin });
  api.registerTool(myTool, { name: "tool_name" });
  api.registerService({ id: "my-poller", start, stop });
}
```

## Discovery

Moltbot discovers extensions from:
1. `~/.clawdbot/extensions/` — user extensions (`.js`, `.ts`, `.mjs`)
2. Workspace `node_modules` — npm packages with `clawdbot` field in package.json
3. Bundled plugins — shipped with Moltbot

Extensions can be single files or directories with `clawdbot.plugin.json`.

## Key Patterns from Slack Plugin

1. **Account resolution** is central — everything goes through `resolveAccount()`
2. **Token management** — separate read/write tokens, env vars vs config
3. **Action dispatch** — big switch on action type, delegates to API modules
4. **Gateway startup** — lazy imports to avoid init cycles
5. **Status probing** — health checks via API calls

## Zulip Differences

- Zulip uses **long-polling** (not WebSocket like Slack)
- Zulip has **topics** as first-class (Slack has threads, different model)
- Zulip uses **email + API key** auth (not OAuth tokens)
- Zulip's API is simpler — REST only, no socket mode
- Zulip has more generous rate limits

## Minimum Viable Plugin

To get a working channel:
1. `id`, `meta`, `capabilities`
2. `config.listAccountIds`, `config.resolveAccount`
3. `outbound.sendText` (send a message)
4. `gateway.startAccount` (receive messages via long-poll)
5. `actions.handleAction` for "send" action

Everything else can be added incrementally.
