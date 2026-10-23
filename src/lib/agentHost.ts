import ChatActivity from '@/interfaces/ChatActivity';
import ACPClientHandlers from '@/interfaces/ACPClientHandlers';
import ProviderClient from '@/interfaces/ProviderClient';
import type { SessionMode } from '@/interfaces/SessionMode';
import { CursorClient } from '@/acp/CursorClient';
import type { CursorCliCommand } from '@/lib/cursorCliCommand';
import { checkCliCommand } from '@/lib/cliCommandCheck';
import type * as acp from '@agentclientprotocol/sdk';

const agents = new Map<number, { client: ProviderClient | undefined; ready: boolean }>();

// MCP servers handed to every ACP session (set once at startup by main.ts).
let agentMcpServers: acp.McpServer[] = [];

export function setAgentMcpServers(servers: acp.McpServer[]): void {
    agentMcpServers = servers;
}

function createHandlers(onActivity: (entry: ChatActivity) => void): ACPClientHandlers {
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

// Set by main.ts; persists each new session id to the Chat row.
let persistSessionId: (chatId: number, sessionId: string) => Promise<void>;

export function setAgentSessionPersister(persister: (chatId: number, sessionId: string) => Promise<void>): void {
    persistSessionId = persister;
}

let cursorCliCommandProvider: (() => Promise<CursorCliCommand>) | undefined;

export function setCursorCliCommandProvider(provider: () => Promise<CursorCliCommand>): void {
    cursorCliCommandProvider = provider;
}

async function startAgent(
    chatId: number,
    sessionId: string | undefined,
    onActivity: (entry: ChatActivity) => void,
    command: CursorCliCommand,
): Promise<{ client: ProviderClient; ready: boolean }> {
    agents.set(chatId, { client: undefined, ready: false });
    const client = new CursorClient(createHandlers(onActivity), command, sessionId, agentMcpServers);
    try{
      await client.connect();
    }
    catch (error) {
      console.error('Agent connect failed for chat', chatId, error);
      client.dispose();
      agents.delete(chatId);
      throw new Error(error instanceof Error ? error.message : String(error));
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
    if (existing?.client) {
      console.log("Existing agent found, returning session ID");
      return existing.client.getSessionId();
    }
    if (existing) {
      agents.delete(chatId);
    }

    if (!cursorCliCommandProvider) {
        throw new Error('Cursor CLI command provider is not set');
    }
    const command = await cursorCliCommandProvider();

    const availability = await checkCliCommand(command);
    if (availability.ok === false) {
      throw new Error(`Cursor CLI is unavailable: ${availability.message}`);
    }

    const storedId = sessionId && sessionId.length > 0 ? sessionId : undefined;
    try {
      const started = await startAgent(chatId, storedId, onActivity, command);
      agents.set(chatId, started);
      return started.client.getSessionId();
    } catch (error) {
      if (!storedId) {
        agents.delete(chatId);
        throw error;
      }
      // A stored id can be stale; fall back to a fresh session.
      console.log("Failed to connect to existing agent, creating a new agent");
      try {
        const started = await startAgent(chatId, undefined, onActivity, command);
        agents.set(chatId, started);
        return started.client.getSessionId();
      } catch (retryError) {
        agents.delete(chatId);
        throw retryError;
      }
    }
}

export async function applyModelChoice(
  chatId: number,
  choice: { modelId: string; reasoning?: string; fast: boolean },
): Promise<void> {
  const agent = agents.get(chatId);
  if (!agent?.client) {
    throw new Error('Agent is not connected');
  }
  await agent.client.applyModelChoice(choice);
}

export async function setMode(chatId: number, mode: SessionMode): Promise<void> {
  const agent = agents.get(chatId);
  if (!agent?.client) {
    throw new Error('Agent is not connected');
  }
  await agent.client.setMode(mode);
}

export async function cancelRequest(chatId: number): Promise<void> {
  const agent = agents.get(chatId);
  if (!agent) {
    throw new Error('Agent is not connected');
  }
  await agent.client?.cancel();
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
