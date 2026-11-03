import ChatActivity from '@/interfaces/ChatActivity';
import ACPClientHandlers from '@/interfaces/ACPClientHandlers';
import type { AgentResult, AgentSession } from '@/interfaces/AgentSession';
import { CursorClient } from '@/acp/CursorClient';
import { OpenCodeClient } from '@/acp/OpenCodeClient';
import { checkCliCommand } from '@/lib/cliCommandCheck';
import { readOpenCodeAuth } from '@/lib/openCodeAuth';
import { sameTurnConfig, type TurnConfig } from '@/lib/turnConfig';
import type MessageModel from '@/models/MessageModel';
import type * as acp from '@agentclientprotocol/sdk';

export type ClaimResult =
  | { ok: true }
  | { ok: false; stored: string | null };

// Writes one message row. Role is 0 for the user and 1 for the assistant.
export type StoreMessages = (
  chatId: number,
  messageId: string | null,
  message: string,
  role: number,
) => Promise<void>;

export interface AgentHostOptions {
  mcpServers: acp.McpServer[];
  persistSessionId: (chatId: number, sessionId: string) => Promise<void>;
  claimProvider: (chatId: number, provider: string) => Promise<ClaimResult>;
  resolveCli: (provider: string) => Promise<string>;
  storeMessage: StoreMessages;
  getMessage: (messageId: string) => Promise<MessageModel | undefined>;
  onActivity: (chatId: number, entry: ChatActivity) => void;
  askPermission: (chatId: number, params: acp.RequestPermissionRequest) => Promise<string | null>;
  releasePermission: (chatId: number) => void;
}

type LiveAgent = {
  client: AgentSession | undefined;
  ready: boolean;
  provider: string;
  applied?: TurnConfig;
};

type ConnectableSession = AgentSession & {
  connect(): Promise<unknown>;
};

type Spawned =
  | { ok: true; client: AgentSession }
  | { ok: false; sessionId: string | null; error: unknown };

function liveSessionId(client: AgentSession | undefined): string | null {
  if (!client) {
    return null;
  }
  const sessionId = client.getSessionId();
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
}

function failureResult(
  provider: string | null,
  sessionId: string | null,
  error: unknown,
): AgentResult {
  const auth = readOpenCodeAuth(error);
  const message = auth?.message ?? (error instanceof Error ? error.message : String(error));
  return { ok: false, provider, sessionId, message };
}

export class AgentHost {
  private readonly agents = new Map<number, LiveAgent>();
  private messageChunks = new Map<number, Map<string | null, string[]>>();
  private readonly pendingConnects = new Map<number, Promise<AgentResult>>();

  constructor(private readonly options: AgentHostOptions) {}

  // A second connect during load starts another session/load and appends the
  // transcript a second time, so all callers for one chat share one flight.
  ensureAgent(input: {
    chatId: number;
    sessionId: string;
    provider: string;
  }): Promise<AgentResult> {
    const pending = this.pendingConnects.get(input.chatId);
    if (pending) {
      return pending;
    }
    const connect = this.connectAgent(input).finally(() => {
      this.pendingConnects.delete(input.chatId);
    });
    this.pendingConnects.set(input.chatId, connect);
    return connect;
  }

  async sendAgentTurn(input: {
    chatId: number;
    sessionId: string;
    config: TurnConfig;
    text: string;
    userText: string;
  }): Promise<AgentResult> {
    const connected = await this.ensureAgent({
      chatId: input.chatId,
      sessionId: input.sessionId,
      provider: input.config.provider,
    });
    if (connected.ok === false) {
      return connected;
    }
    const agent = this.agents.get(input.chatId);
    const client = agent?.client;
    if (!agent || !client) {
      return {
        ok: false,
        provider: input.config.provider,
        sessionId: connected.sessionId,
        message: 'Agent is not connected',
      };
    }
    try {
      await this.writeTurnIfChanged(input.chatId, client, input.config);
      await client.sendMessage(input.text);
      await this.options.storeMessage(input.chatId, null, input.userText, 0);
      const byMessage = this.messageChunks.get(input.chatId);
      if (byMessage) {
        for (const [messageId, chunks] of byMessage) {
          await this.options.storeMessage(input.chatId, messageId, chunks.join(''), 1);
        }
      }
    } catch (error) {
      return failureResult(
        input.config.provider,
        liveSessionId(client) ?? connected.sessionId,
        error,
      );
    } finally {
      this.messageChunks.delete(input.chatId);
    }
    return connected;
  }

  createHandlers(chatId: number, onActivity: (entry: ChatActivity) => void): ACPClientHandlers {
    const toolEntries = new Map<string, Extract<ChatActivity, { kind: 'tool' }>>();

    return {
      handleRequestPermission: async (params) => {
        if (params.toolCall.title === 'sqlmcp-execute_sql: execute_sql') {
          return { outcome: { outcome: 'selected', optionId: 'allow_always' } };
        }
        const optionId = await this.options.askPermission(chatId, params);
        if (!optionId) {
          return { outcome: { outcome: 'cancelled' } };
        }
        return { outcome: { outcome: 'selected', optionId } };
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
        const raw = update.content.type === 'text' ? update.content.text : '';
        const lines = raw.split('\n');
        const stripped =
          lines[0]?.startsWith('dangerousQueries:') && lines[1]?.startsWith('connectionId:')
            ? lines.slice(2).join('\n')
            : raw;
        onActivity({
          key: '',
          kind: 'user',
          text: stripped || raw,
        });
      },
      onToolCall: (update) => {
        const entry: Extract<ChatActivity, { kind: 'tool' }> = {
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
        const entry: Extract<ChatActivity, { kind: 'tool' }> = {
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
          steps: update.entries.map((entry) => ({ content: entry.content, status: entry.status })),
        });
      },
      onAvailableCommandsUpdate: () => undefined,
    };
  }


  async applyLiveConfig(chatId: number, config: TurnConfig): Promise<AgentResult> {
    const agent = this.agents.get(chatId);
    const client = agent?.ready ? agent.client : undefined;
    if (!agent || !client) {
      return { ok: true, provider: config.provider, sessionId: '' };
    }
    if (agent.provider !== config.provider) {
      return {
        ok: false,
        provider: agent.provider,
        sessionId: client.getSessionId(),
        message: `This chat is connected to ${agent.provider}`,
      };
    }
    try {
      await this.writeTurnIfChanged(chatId, client, config);
      return { ok: true, provider: config.provider, sessionId: client.getSessionId() };
    } catch (error) {
      return failureResult(config.provider, liveSessionId(client), error);
    }
  }

  async cancelRequest(chatId: number): Promise<void> {
    this.options.releasePermission(chatId);
    const agent = this.agents.get(chatId);
    if (!agent) {
      throw new Error('Agent is not connected');
    }
    await agent.client?.cancel();
  }

  disposeAllAgents(): void {
    for (const chatId of [...this.agents.keys()]) {
      this.disposeAgent(chatId);
    }
  }

  disposeAgent(chatId: number): void {
    this.options.releasePermission(chatId);
    const agent = this.agents.get(chatId);
    if (!agent) {
      return;
    }
    this.agents.delete(chatId);
    if (agent.ready) {
      agent.client?.dispose();
    }
  }

  private messageStoreHandler(chatId: number, messageId: string | null, text: string): void {
    let byMessage = this.messageChunks.get(chatId);
    if (!byMessage) {
      byMessage = new Map();
      this.messageChunks.set(chatId, byMessage);
    }
    const chunks = byMessage.get(messageId) ?? [];
    chunks.push(text);
    byMessage.set(messageId, chunks);
  }

  private createClient(
    chatId: number,
    provider: string,
    command: string,
    existingSessionId: string | undefined,
  ): ConnectableSession {
    const handlers = this.createHandlers(chatId, (entry) => this.options.onActivity(chatId, entry));
    const storeChunk = (id: number, messageId: string | null, text: string) => {
      this.messageStoreHandler(id, messageId, text);
    };
    if (provider === 'cursor') {
      return new CursorClient(chatId, storeChunk, handlers, command, existingSessionId, this.options.mcpServers);
    }
    if (provider === 'opencode') {
      return new OpenCodeClient(chatId, storeChunk, handlers, command, existingSessionId, this.options.mcpServers);
    }
    throw new Error(`Unknown provider: ${provider}`);
  }

  private async spawnAgent(
    chatId: number,
    provider: string,
    command: string,
    existingSessionId: string | undefined,
  ): Promise<Spawned> {
    const client = this.createClient(chatId, provider, command, existingSessionId);
    this.agents.set(chatId, { client, ready: false, provider });
    try {
      await client.connect();
    } catch (error) {
      const sessionId = liveSessionId(client);
      client.dispose();
      if (this.agents.get(chatId)?.client === client) {
        this.agents.delete(chatId);
      }
      console.error('Agent connect failed for chat', chatId, error);
      return { ok: false, sessionId, error };
    }
    if (this.agents.get(chatId)?.client === client) {
      this.agents.set(chatId, { client, ready: true, provider });
    }
    return { ok: true, client };
  }

  private async rememberSession(
    chatId: number,
    provider: string,
    client: AgentSession,
  ): Promise<AgentResult> {
    const sessionId = client.getSessionId();
    try {
      await this.options.persistSessionId(chatId, sessionId);
    } catch (error) {
      return failureResult(provider, sessionId, error);
    }
    return { ok: true, provider, sessionId };
  }

  private async connectAgent(input: {
    chatId: number;
    sessionId: string;
    provider: string;
  }): Promise<AgentResult> {
    const { chatId, sessionId, provider } = input;
    const claim = await this.options.claimProvider(chatId, provider);
    if (claim.ok === false) {
      return {
        ok: false,
        provider: claim.stored,
        sessionId: null,
        message: claim.stored ? `This chat already uses ${claim.stored}` : 'Chat not found',
      };
    }

    const existing = this.agents.get(chatId);
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

    let command: string;
    try {
      command = await this.options.resolveCli(provider);
    } catch (error) {
      return failureResult(provider, null, error);
    }
    const availability = await checkCliCommand(command);
    if (availability.ok === false) {
      return { ok: false, provider, sessionId: null, message: availability.message };
    }

    if (existing) {
      this.agents.delete(chatId);
      existing.client?.dispose();
    }

    const storedId = sessionId.length > 0 ? sessionId : undefined;
    let spawned = await this.spawnAgent(chatId, provider, command, storedId);
    if (spawned.ok === false && storedId) {
      spawned = await this.spawnAgent(chatId, provider, command, undefined);
    }
    if (spawned.ok === false) {
      return failureResult(provider, spawned.sessionId, spawned.error);
    }
    return this.rememberSession(chatId, provider, spawned.client);
  }

  private async writeTurnIfChanged(
    chatId: number,
    client: AgentSession,
    config: TurnConfig,
  ): Promise<void> {
    const agent = this.agents.get(chatId);
    if (agent?.applied && sameTurnConfig(agent.applied, config)) {
      return;
    }
    await client.applyTurn(config);
    const current = this.agents.get(chatId);
    if (current?.client === client) {
      current.applied = config;
    }
  }
}
