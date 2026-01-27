/**
 * Zulip Moltbot Plugin — Entry Point
 * 
 * Registers the Zulip channel plugin, tools, and services with Moltbot.
 */

const { zulipPlugin, loadCredentials, zulipApi } = require('./plugin.js');

function register(api) {
  const logger = api.logger ?? console;

  // Register channel plugin
  api.registerChannel({ plugin: zulipPlugin });

  // Register agent tools
  if (api.registerTool) {
    api.registerTool({
      name: 'zulip_send',
      description: 'Send a message to Zulip',
      parameters: {
        type: 'object',
        properties: {
          stream: { type: 'string', description: 'Stream name' },
          topic: { type: 'string', description: 'Topic (required for streams)' },
          user: { type: 'string', description: 'User email (for DMs)' },
          message: { type: 'string', description: 'Message content' },
        },
        required: ['message'],
      },
      execute: async (toolCallId, params) => {
        const creds = loadCredentials();
        if (!creds) return { error: 'No Zulip credentials configured' };

        if (params.stream) {
          const data = { type: 'stream', to: params.stream, content: params.message, topic: params.topic ?? 'general' };
          const result = await zulipApi(creds, '/messages', 'POST', data);
          return result.result === 'success' ? { ok: true, messageId: result.id } : { ok: false, error: result.msg };
        } else if (params.user) {
          const data = { type: 'private', to: params.user, content: params.message };
          const result = await zulipApi(creds, '/messages', 'POST', data);
          return result.result === 'success' ? { ok: true, messageId: result.id } : { ok: false, error: result.msg };
        }
        return { error: 'Must specify either stream or user' };
      },
    }, { name: 'zulip_send' });

    api.registerTool({
      name: 'zulip_read',
      description: 'Read messages from a Zulip stream/topic',
      parameters: {
        type: 'object',
        properties: {
          stream: { type: 'string', description: 'Stream name' },
          topic: { type: 'string', description: 'Topic (optional filter)' },
          limit: { type: 'number', description: 'Number of messages (default 10)' },
        },
        required: ['stream'],
      },
      execute: async (toolCallId, params) => {
        const creds = loadCredentials();
        if (!creds) return { error: 'No Zulip credentials configured' };

        const narrow = [{ operator: 'stream', operand: params.stream }];
        if (params.topic) narrow.push({ operator: 'topic', operand: params.topic });

        const qs = new URLSearchParams({
          narrow: JSON.stringify(narrow),
          num_before: String(params.limit ?? 10),
          num_after: '0',
          anchor: 'newest',
        }).toString();

        const result = await zulipApi(creds, `/messages?${qs}`);
        if (result.result === 'success') {
          return {
            ok: true,
            messages: (result.messages ?? []).reverse().map(m => ({
              id: m.id,
              sender: m.sender_full_name,
              topic: m.subject,
              content: m.content.replace(/<[^>]*>/g, ''),
              timestamp: m.timestamp,
            })),
          };
        }
        return { ok: false, error: result.msg };
      },
    }, { name: 'zulip_read' });

    api.registerTool({
      name: 'zulip_react',
      description: 'Add or remove a reaction on a Zulip message',
      parameters: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
          emoji: { type: 'string', description: 'Emoji name (e.g., heart, thumbs_up)' },
          remove: { type: 'boolean', description: 'Remove reaction instead of adding' },
        },
        required: ['messageId', 'emoji'],
      },
      execute: async (toolCallId, params) => {
        const creds = loadCredentials();
        if (!creds) return { error: 'No Zulip credentials configured' };

        const method = params.remove ? 'DELETE' : 'POST';
        const result = await zulipApi(creds, `/messages/${params.messageId}/reactions`, method, { emoji_name: params.emoji });
        return { ok: result.result === 'success', error: result.msg };
      },
    }, { name: 'zulip_react' });
  }

  logger.info('[zulip] Plugin registered');
}

module.exports = register;
module.exports.default = register;
module.exports.id = 'zulip';
module.exports.name = 'Zulip';
