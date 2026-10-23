import ChatActivity from '@/interfaces/ChatActivity';
import ACPClientHandlers from '@/interfaces/ACPClientHandlers';
import type { AgentResult, AgentSession } from '@/interfaces/AgentSession';
import type { SessionMode } from '@/interfaces/SessionMode';
import { CursorClient } from '@/acp/CursorClient';
import { OpenCodeClient } from '@/acp/OpenCodeClient';
import { checkCliCommand } from '@/lib/cliCommandCheck';
import type { CliProvider } from '@/lib/cliCommand';
import { readOpenCodeAuth } from '@/lib/openCodeAuth';
import type { TurnConfig } from '@/lib/turnConfig';
import type * as acp from '@agentclientprotocol/sdk';

export type ClaimResult =
  | { ok: true }
  | { ok: false; stored: CliProvider | null };

type LiveAgent = {
  client: AgentSession | undefined;
  ready: boolean;
  provider: CliProvider;
};

type ConnectableSession = AgentSession & {
  connect(): Promise<unknown>;
};

const agents = new Map<number, LiveAgent>();

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

let claimProvider: ((chatId: number, provider: CliProvider) => Promise<ClaimResult>) | undefined;

export function setChatProviderClaim(
  claim: (chatId: number, provider: CliProvider) => Promise<ClaimResult>,
): void {
  claimProvider = claim;
}

let resolveAgentCli: ((provider: CliProvider) => Promise<string>) | undefined;

export function setAgentCliResolver(
  resolve: (provider: CliProvider) => Promise<string>,
): void {
  resolveAgentCli = resolve;
}

function liveSessionId(client: AgentSession | undefined): string | null {
  if (!client) {
    return null;
  }
  const sessionId = client.getSessionId();
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
}

function failureResult(
  provider: CliProvider | null,
  sessionId: string | null,
  error: unknown,
): AgentResult {
  const auth = readOpenCodeAuth(error);
  const message = auth?.message ?? (error instanceof Error ? error.message : String(error));
  return { ok: false, provider, sessionId, message };
}

function createClient(
  provider: CliProvider,
  command: string,
  existingSessionId: string | undefined,
  onActivity: (entry: ChatActivity) => void,
): ConnectableSession {
  const handlers = createHandlers(onActivity);
  if (provider === 'cursor') {
    return new CursorClient(handlers, command, existingSessionId, agentMcpServers);
  }
  if (provider === 'opencode') {
    return new OpenCodeClient({
      handlers,
      command,
      existingSessionId,
      mcpServers: agentMcpServers,
    });
  }
  const _exhaustive: never = provider;
  return _exhaustive;
}

type Spawned =
  | { ok: true; client: AgentSession }
  | { ok: false; sessionId: string | null; error: unknown };

async function spawnAgent(
  chatId: number,
  provider: CliProvider,
  command: string,
  existingSessionId: string | undefined,
  onActivity: (entry: ChatActivity) => void,
): Promise<Spawned> {
  agents.set(chatId, { client: undefined, ready: false, provider });
  const client = createClient(provider, command, existingSessionId, onActivity);
  try {
    await client.connect();
  } catch (error) {
    const sessionId = liveSessionId(client);
    client.dispose();
    agents.delete(chatId);
    console.error('Agent connect failed for chat', chatId, error);
    return { ok: false, sessionId, error };
  }
  agents.set(chatId, { client, ready: true, provider });
  return { ok: true, client };
}

async function rememberSession(
  chatId: number,
  provider: CliProvider,
  client: AgentSession,
): Promise<AgentResult> {
  const sessionId = client.getSessionId();
  if (persistSessionId) {
    try {
      await persistSessionId(chatId, sessionId);
    } catch (error) {
      return failureResult(provider, sessionId, error);
    }
  }
  return { ok: true, provider, sessionId };
}

export async function ensureAgent(input: {
  chatId: number;
  sessionId: string;
  provider: CliProvider;
  onActivity: (entry: ChatActivity) => void;
}): Promise<AgentResult> {
  const { chatId, sessionId, provider, onActivity } = input;
  if (!claimProvider) {
    return { ok: false, provider: null, sessionId: null, message: 'Chat provider claim is not set' };
  }
  const claim = await claimProvider(chatId, provider);
  if (claim.ok === false) {
    return {
      ok: false,
      provider: claim.stored,
      sessionId: null,
      message: claim.stored ? `This chat already uses ${claim.stored}` : 'Chat not found',
    };
  }

  const existing = agents.get(chatId);
  if (existing && existing.provider !== provider) {
    return {
      ok: false,
      provider: existing.provider,
      sessionId: liveSessionId(existing.client),
      message: `This chat is connected to ${existing.provider}`,
    };
  }
  if (existing?.ready && existing.client) {
    return { ok: true, provider, sessionId: existing.client.getSessionId() };
  }

  if (!resolveAgentCli) {
    return { ok: false, provider, sessionId: null, message: 'Agent CLI resolver is not set' };
  }
  let command: string;
  try {
    command = await resolveAgentCli(provider);
  } catch (error) {
    return failureResult(provider, null, error);
  }
  const availability = await checkCliCommand(command);
  if (availability.ok === false) {
    return { ok: false, provider, sessionId: null, message: availability.message };
  }

  if (existing) {
    agents.delete(chatId);
  }

  const storedId = sessionId.length > 0 ? sessionId : undefined;
  let spawned = await spawnAgent(chatId, provider, command, storedId, onActivity);
  if (spawned.ok === false && storedId) {
    spawned = await spawnAgent(chatId, provider, command, undefined, onActivity);
  }
  if (spawned.ok === false) {
    return failureResult(provider, spawned.sessionId, spawned.error);
  }
  return rememberSession(chatId, provider, spawned.client);
}

export async function sendAgentTurn(input: {
  chatId: number;
  sessionId: string;
  config: TurnConfig;
  text: string;
  onActivity: (entry: ChatActivity) => void;
}): Promise<AgentResult> {
  const connected = await ensureAgent({
    chatId: input.chatId,
    sessionId: input.sessionId,
    provider: input.config.provider,
    onActivity: input.onActivity,
  });
  if (connected.ok === false) {
    return connected;
  }
  const client = agents.get(input.chatId)?.client;
  if (!client) {
    return {
      ok: false,
      provider: input.config.provider,
      sessionId: connected.sessionId,
      message: 'Agent is not connected',
    };
  }
  try {
    await client.applyTurn(input.config);
    await client.sendMessage(input.text);
  } catch (error) {
    return failureResult(
      input.config.provider,
      liveSessionId(client) ?? connected.sessionId,
      error,
    );
  }
  return connected;
}

export async function applyModelChoice(
  chatId: number,
  choice: { modelId: string; reasoning?: string; fast: boolean },
): Promise<void> {
  const client = agents.get(chatId)?.client;
  if (!(client instanceof CursorClient)) {
    throw new Error('Agent is not connected');
  }
  await client.applyModelChoice(choice);
}

export async function setMode(chatId: number, mode: SessionMode): Promise<void> {
  const client = agents.get(chatId)?.client;
  if (!(client instanceof CursorClient)) {
    throw new Error('Agent is not connected');
  }
  await client.setMode(mode);
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
