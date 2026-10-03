import ChatActivity from '@/interfaces/ChatActivity';
import ACPClientHandlers from '@/interfaces/ACPClientHandlers';
import { CursorClient } from '@/acp/CursorClient';

const agents = new Map<number, { client: CursorClient | undefined; ready: boolean }>();

function createHandlers(onActivity: (entry: ChatActivity) => void): ACPClientHandlers {
  // Last known entry per tool call, so a status-only update keeps the title.
  const toolEntries = new Map<string, ChatActivity>();

  return {
    handleRequestPermission: async (params) => {
      const option =
        params.options.find((item) => item.kind === 'allow_once' || item.kind === 'allow_always') ??
        params.options[0];
      if (!option) {
        return { outcome: { outcome: 'cancelled' } };
      }
      return { outcome: { outcome: 'selected', optionId: option.optionId } };
    },
    onAgentMessageChunk: (update) => {
      onActivity({
        key: '',
        kind: 'agent_message',
        text: update.content.type === 'text' ? update.content.text : '',
      });
    },
    onAgentThoughtChunk: (update) => {
      onActivity({
        key: '',
        kind: 'agent_thought',
        text: update.content.type === 'text' ? update.content.text : '',
      });
    },
    onUserMessageChunk: (update) => {
      onActivity({
        key: '',
        kind: 'user',
        text: update.content.type === 'text' ? update.content.text : '',
      });
    },
    onToolCall: (update) => {
      const entry: ChatActivity = {
        key: update.toolCallId,
        kind: 'tool',
        text: update.title,
        status: update.status,
      };
      toolEntries.set(update.toolCallId, entry);
      onActivity(entry);
    },
    onToolCallUpdate: (update) => {
      const existing = toolEntries.get(update.toolCallId);
      const entry: ChatActivity = {
        key: update.toolCallId,
        kind: 'tool',
        text: update.title ?? existing?.text ?? '',
        status: update.status ?? existing?.status,
      };
      toolEntries.set(update.toolCallId, entry);
      onActivity(entry);
    },
    onPlan: (update) => {
      onActivity({
        key: 'plan',
        kind: 'plan',
        text: update.entries
          .map((entry) => `${entry.content} (${entry.status})`)
          .join('\n'),
      });
    onOtherUpdate: (update:any) => {
      console.log('onOtherUpdate', update);
    }
    },
    onAvailableCommandsUpdate: () => undefined,
  };
}

// Wired by main.ts so a newly created session id lands in the Chat row.
// Method for persisting the session id to the database.
let persistSessionId: (chatId: number, sessionId: string) => Promise<void>;

export function setAgentSessionPersister(persister: (chatId: number, sessionId: string) => Promise<void>): void {
    persistSessionId = persister;
}

async function startAgent(
    chatId: number,
    sessionId: string | undefined,
    onActivity: (entry: ChatActivity) => void,
): Promise<{ client: CursorClient | undefined; ready: boolean }> {
    agents.set(chatId, { client: undefined, ready: false });
    const client = new CursorClient(createHandlers(onActivity), sessionId);
    try{
      await client.connect();
    }
    catch (error) {
      console.error('Agent connect failed for chat', chatId, error);
      return { client: undefined, ready: false };
    }
    if (persistSessionId) {
        await persistSessionId(chatId, client.getSessionId());
    }
    return { client, ready: true };
}

export async function ensureAgent(
    chatId: number,
    sessionId: string | undefined,
    onActivity: (entry: ChatActivity) => void,
): Promise<string> {
    const existing = agents.get(chatId);
    if (existing) {
      console.log("Existing agent found, returning session ID");
        return existing.client?.getSessionId() ?? '';
    }

    const storedId = sessionId && sessionId.length > 0 ? sessionId : undefined;
    let client: CursorClient | undefined;
    let ready: boolean;
    ({ client, ready } = await startAgent(chatId, storedId, onActivity));
    if (!client) {
      // Create a new agent without loading a session
      console.log("Failed to connect to existing agent, creating a new agent");
      ({ client, ready } = await startAgent(chatId, storedId, onActivity));
    }
    // A stored id can be stale (agent restarts, old placeholder UUIDs).
    // Fall back to a fresh session instead of leaving the chat unusable.
    agents.set(chatId, { client, ready });
    return client?.getSessionId() ?? '';
}

export function disposeAllAgents(): void {
  for (const chatId of [...agents.keys()]) {
    disposeAgent(chatId);
  }
}

export function disposeAgent(chatId: number): void {
    const agent = agents.get(chatId);
    if (!agent) {
        return;
    }
    agents.delete(chatId);
    if (agent.ready) {
      agent.client?.dispose();
    }
}

export async function promptAgent(chatId: number, text: string): Promise<unknown> {
  const agent = agents.get(chatId);
  if (!agent) {
    throw new Error('Agent is not connected');
  }
  if (!agent.ready) {
    throw new Error('Agent is not ready');
  }
  return await agent.client?.sendMessage(text);
}
