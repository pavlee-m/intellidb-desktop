import ChatActivity from '@/interfaces/ChatActivity';
import ACPClientHandlers from '@/interfaces/ACPClientHandlers';
import type { AgentResult, AgentSession } from '@/interfaces/AgentSession';
import { CursorClient } from '@/acp/CursorClient';
import { OpenCodeClient } from '@/acp/OpenCodeClient';
import { checkCliCommand } from '@/lib/cliCommandCheck';
import type { CliProvider } from '@/lib/cliCommand';
import { readOpenCodeAuth } from '@/lib/openCodeAuth';
import { sameTurnConfig, type TurnConfig } from '@/lib/turnConfig';
import type MessageModel from '@/models/MessageModel';
import type * as acp from '@agentclientprotocol/sdk';

export type ClaimResult =
  | { ok: true }
  | { ok: false; stored: CliProvider | null };

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
  claimProvider: (chatId: number, provider: CliProvider) => Promise<ClaimResult>;
  resolveCli: (provider: CliProvider) => Promise<string>;
  storeMessage: StoreMessages;
  getMessage: (messageId: string) => Promise<MessageModel | undefined>;
}

type LiveAgent = {
  client: AgentSession | undefined;
  ready: boolean;
  provider: CliProvider;
  applied?: TurnConfig;
};

type ConnectableSession = AgentSession & {
  connect(): Promise<unknown>;
};

type Spawned =
  | { ok: true; client: AgentSession }
  | { ok: false; sessionId: string | null; error: unknown };

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
    provider: CliProvider;
    onActivity: (entry: ChatActivity) => void;
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
    onActivity: (entry: ChatActivity) => void;
  }): Promise<AgentResult> {
    const connected = await this.ensureAgent({
      chatId: input.chatId,
      sessionId: input.sessionId,
      provider: input.config.provider,
      onActivity: input.onActivity,
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
    provider: CliProvider,
    command: string,
    existingSessionId: string | undefined,
    onActivity: (entry: ChatActivity) => void,
  ): ConnectableSession {
    const handlers = createHandlers(onActivity);
    const storeChunk = (id: number, messageId: string | null, text: string) => {
      this.messageStoreHandler(id, messageId, text);
    };
    if (provider === 'cursor') {
      return new CursorClient(chatId, storeChunk, handlers, command, existingSessionId, this.options.mcpServers);
    }
    if (provider === 'opencode') {
      return new OpenCodeClient(chatId, storeChunk, handlers, command, existingSessionId, this.options.mcpServers);
    }
    const _exhaustive: never = provider;
    return _exhaustive;
  }

  private async spawnAgent(
    chatId: number,
    provider: CliProvider,
    command: string,
    existingSessionId: string | undefined,
    onActivity: (entry: ChatActivity) => void,
  ): Promise<Spawned> {
    const client = this.createClient(chatId, provider, command, existingSessionId, onActivity);
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
    provider: CliProvider,
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
    provider: CliProvider;
    onActivity: (entry: ChatActivity) => void;
  }): Promise<AgentResult> {
    const { chatId, sessionId, provider, onActivity } = input;
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
    let spawned = await this.spawnAgent(chatId, provider, command, storedId, onActivity);
    if (spawned.ok === false && storedId) {
      spawned = await this.spawnAgent(chatId, provider, command, undefined, onActivity);
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
