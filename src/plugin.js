/**
 * Zulip Channel Plugin for Moltbot
 * 
 * Provides bidirectional Zulip messaging with topic-aware routing,
 * reactions, and persona support.
 */

const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

// --- Credentials ---

function loadCredentials() {
  const secretsPath = join(homedir(), '.clawdbot', 'secrets', 'zulip.env');
  if (!existsSync(secretsPath)) return null;

  const content = readFileSync(secretsPath, 'utf-8');
  const creds = {};
  for (const line of content.split('\n')) {
    const [key, ...rest] = line.split('=');
    const value = rest.join('=').trim();
    if (key === 'ZULIP_EMAIL') creds.email = value;
    if (key === 'ZULIP_API_KEY') creds.apiKey = value;
    if (key === 'ZULIP_SITE') creds.site = value;
  }
  return (creds.email && creds.apiKey && creds.site) ? creds : null;
}

// --- API Client ---

async function zulipApi(creds, endpoint, method = 'GET', data) {
  const url = new URL(`/api/v1${endpoint}`, creds.site);
  const auth = Buffer.from(`${creds.email}:${creds.apiKey}`).toString('base64');
  const headers = { 'Authorization': `Basic ${auth}` };

  let body;
  if (data && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(data).toString();
  }

  const response = await fetch(url.toString(), { method, headers, body });
  return response.json();
}

// --- Channel Plugin Definition ---

const zulipPlugin = {
  id: 'zulip',

  meta: {
    id: 'zulip',
    label: 'Zulip',
    selectionLabel: 'Zulip (Bot API)',
    docsPath: '/channels/zulip',
    blurb: 'Zulip team chat with topic-aware routing.',
    aliases: ['zulip'],
  },

  capabilities: {
    chatTypes: ['direct', 'channel', 'thread'],
    reactions: true,
    threads: true,   // Zulip topics = threads
    media: true,
    nativeCommands: false,
  },

  config: {
    listAccountIds: (_cfg) => {
      const creds = loadCredentials();
      return creds ? ['default'] : [];
    },

    resolveAccount: (_cfg, accountId) => {
      const creds = loadCredentials();
      if (!creds) return null;
      return {
        accountId: accountId ?? 'default',
        name: 'Zulip Bot',
        email: creds.email,
        apiKey: creds.apiKey,
        site: creds.site,
        enabled: true,
        config: {},
      };
    },

    defaultAccountId: (_cfg) => 'default',

    isConfigured: (account) => Boolean(account?.email && account?.apiKey && account?.site),

    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.email && account.apiKey),
    }),
  },

  messaging: {
    normalizeTarget: (target) => {
      if (!target) return target;
      // Support formats: "stream:general", "private:user@email.com", raw stream name
      if (target.startsWith('stream:') || target.startsWith('private:')) return target;
      return `stream:${target}`;
    },
    targetResolver: {
      looksLikeId: (input) => input.startsWith('stream:') || input.startsWith('private:') || input.includes('@'),
      hint: '<stream:name|private:email>',
    },
  },

  outbound: {
    deliveryMode: 'direct',
    chunker: null,
    textChunkLimit: 10000, // Zulip supports long messages

    sendText: async ({ to, text, accountId, cfg, replyToId }) => {
      const account = zulipPlugin.config.resolveAccount(cfg, accountId);
      if (!account) return { ok: false, error: 'No Zulip account configured' };

      const creds = { email: account.email, apiKey: account.apiKey, site: account.site };

      let type = 'private';
      let target = to;
      let topic = replyToId ?? 'chat';

      if (to.startsWith('stream:')) {
        type = 'stream';
        target = to.slice(7);
      } else if (to.startsWith('private:')) {
        target = to.slice(8);
      }

      const data = { type, to: target, content: text };
      if (type === 'stream') data.topic = topic;

      const result = await zulipApi(creds, '/messages', 'POST', data);

      if (result.result === 'success') {
        return { channel: 'zulip', ok: true, messageId: String(result.id) };
      }
      return { channel: 'zulip', ok: false, error: result.msg };
    },

    sendMedia: async ({ to, text, mediaUrl, accountId, cfg, replyToId }) => {
      // TODO: Upload file to Zulip, then send message with attachment link
      // For now, send text with media URL
      const content = text ? `${text}\n${mediaUrl}` : mediaUrl;
      return zulipPlugin.outbound.sendText({ to, text: content, accountId, cfg, replyToId });
    },
  },

  actions: {
    listActions: ({ cfg }) => {
      const accounts = zulipPlugin.config.listAccountIds(cfg);
      if (accounts.length === 0) return [];
      return ['send', 'react', 'read', 'edit', 'delete'];
    },

    handleAction: async ({ action, params, cfg, accountId }) => {
      const account = zulipPlugin.config.resolveAccount(cfg, accountId);
      if (!account) return { error: 'No Zulip account configured' };

      const creds = { email: account.email, apiKey: account.apiKey, site: account.site };

      if (action === 'send') {
        const to = params.to ?? params.target;
        const message = params.message ?? params.content ?? '';
        const topic = params.threadId ?? params.topic ?? 'chat';

        let type = 'private';
        let target = to;
        if (to?.startsWith('stream:')) {
          type = 'stream';
          target = to.slice(7);
        } else if (to?.startsWith('private:')) {
          target = to.slice(8);
        }

        const data = { type, to: target, content: message };
        if (type === 'stream') data.topic = topic;

        const result = await zulipApi(creds, '/messages', 'POST', data);
        return result.result === 'success'
          ? { ok: true, messageId: String(result.id) }
          : { ok: false, error: result.msg };
      }

      if (action === 'react') {
        const messageId = params.messageId;
        const emoji = params.emoji;
        const remove = params.remove ?? false;

        const method = remove ? 'DELETE' : 'POST';
        const result = await zulipApi(creds, `/messages/${messageId}/reactions`, method, { emoji_name: emoji });
        return { ok: result.result === 'success', error: result.msg };
      }

      if (action === 'read') {
        const stream = params.channelId ?? params.stream;
        const topic = params.topic ?? params.threadId;
        const limit = params.limit ?? 10;

        const narrow = [];
        if (stream) {
          const streamName = stream.startsWith('stream:') ? stream.slice(7) : stream;
          narrow.push({ operator: 'stream', operand: streamName });
        }
        if (topic) narrow.push({ operator: 'topic', operand: topic });

        const queryParams = {
          narrow: JSON.stringify(narrow),
          num_before: String(limit),
          num_after: '0',
          anchor: 'newest',
        };
        const qs = new URLSearchParams(queryParams).toString();
        const result = await zulipApi(creds, `/messages?${qs}`);
        
        if (result.result === 'success') {
          const messages = (result.messages ?? []).reverse().map(m => ({
            id: String(m.id),
            sender: m.sender_full_name,
            senderEmail: m.sender_email,
            content: m.content.replace(/<[^>]*>/g, ''), // strip HTML
            topic: m.subject,
            timestamp: m.timestamp,
            reactions: (m.reactions ?? []).map(r => ({ emoji: r.emoji_name, user: r.user.full_name })),
          }));
          return { ok: true, messages };
        }
        return { ok: false, error: result.msg };
      }

      if (action === 'edit') {
        const messageId = params.messageId;
        const content = params.message ?? params.content;
        const result = await zulipApi(creds, `/messages/${messageId}`, 'PATCH', { content });
        return { ok: result.result === 'success', error: result.msg };
      }

      if (action === 'delete') {
        const messageId = params.messageId;
        const result = await zulipApi(creds, `/messages/${messageId}`, 'DELETE');
        return { ok: result.result === 'success', error: result.msg };
      }

      return { error: `Unsupported action: ${action}` };
    },
  },

  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const creds = { email: account.email, apiKey: account.apiKey, site: account.site };

      ctx.log?.info?.(`[zulip] Starting event poller for ${account.email}`);

      // Register event queue
      const registerResult = await zulipApi(creds, '/register', 'POST', {
        event_types: JSON.stringify(['message', 'reaction']),
      });

      if (registerResult.result !== 'success') {
        ctx.log?.error?.(`[zulip] Failed to register event queue: ${registerResult.msg}`);
        return;
      }

      let queueId = registerResult.queue_id;
      let lastEventId = registerResult.last_event_id;

      // Get our own user ID to filter self-messages
      const meResult = await zulipApi(creds, '/users/me');
      const myUserId = meResult.user_id;

      // Poll loop
      const poll = async () => {
        while (!ctx.abortSignal?.aborted) {
          try {
            const qs = `queue_id=${encodeURIComponent(queueId)}&last_event_id=${lastEventId}`;
            const result = await zulipApi(creds, `/events?${qs}`);

            if (result.result !== 'success') {
              if (String(result.msg).includes('BAD_EVENT_QUEUE_ID')) {
                ctx.log?.warn?.('[zulip] Queue expired, re-registering...');
                const reReg = await zulipApi(creds, '/register', 'POST', {
                  event_types: JSON.stringify(['message', 'reaction']),
                });
                if (reReg.result === 'success') {
                  queueId = reReg.queue_id;
                  lastEventId = reReg.last_event_id;
                }
              }
              continue;
            }

            for (const event of result.events) {
              lastEventId = event.id;

              if (event.type === 'message') {
                const msg = event.message;
                if (msg.sender_id === myUserId) continue;

                const chatId = msg.type === 'stream'
                  ? `stream:${msg.display_recipient}`
                  : `private:${msg.sender_email}`;

                ctx.runtime?.emit?.('message', {
                  channel: 'zulip',
                  accountId: account.accountId,
                  chatId,
                  messageId: String(msg.id),
                  senderId: msg.sender_email,
                  senderName: msg.sender_full_name,
                  text: msg.content.replace(/<[^>]*>/g, ''),
                  threadId: msg.subject ?? undefined,
                  timestamp: msg.timestamp * 1000,
                });
              }
            }
          } catch (err) {
            ctx.log?.error?.(`[zulip] Poll error: ${err.message}`);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      };

      poll();
    },
  },

  status: {
    probeAccount: async ({ account, timeoutMs }) => {
      const creds = { email: account.email, apiKey: account.apiKey, site: account.site };
      try {
        const result = await zulipApi(creds, '/users/me');
        return result.user_id
          ? { ok: true, name: result.full_name }
          : { ok: false, error: result.msg };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  },
};

// --- Export & Registration ---

module.exports = { zulipPlugin, zulipApi, loadCredentials };
