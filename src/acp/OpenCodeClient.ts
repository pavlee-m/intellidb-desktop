import path from 'node:path'
import { ChildProcess, spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import * as acp from '@agentclientprotocol/sdk'
import { ACPClient } from './ACPClient'
import ACPClientHandlers from '../interfaces/ACPClientHandlers'
import type { AgentSession } from '../interfaces/AgentSession'
import type { TurnConfig } from '../lib/turnConfig'
import { readOpenCodeAuth } from '../lib/openCodeAuth'

function flatConfigValues(option: acp.SessionConfigOption): string[] {
  if (option.type !== 'select') {
    return []
  }
  const values: string[] = []
  for (const item of option.options) {
    if ('options' in item) {
      for (const child of item.options) {
        values.push(child.value)
      }
    } else {
      values.push(item.value)
    }
  }
  return values
}

export class OpenCodeClient implements AgentSession {
  readonly provider = 'opencode' as const

  private agentProcess: ChildProcess | undefined
  private connection: acp.ClientConnection | undefined
  private sessionId = ''
  messageStoreHandler: (chatId: number, messageId: string | null, text: string) => void

  constructor(
    private readonly chatId: number,
    messageStoreHandler: (chatId: number, messageId: string | null, text: string) => void,
    private handlers: ACPClientHandlers,
    private command: string,
    private existingSessionId: string | undefined,
    private mcpServers: acp.McpServer[] = [],
  ) {
    this.messageStoreHandler = messageStoreHandler
  }

  getSessionId(): string {
    return this.sessionId
  }

  async connect(): Promise<void> {
    try {
      await this.openSession()
    } catch (error) {
      const auth = readOpenCodeAuth(error)
      if (auth) {
        throw auth
      }
      throw error
    }
  }

  private async openSession(): Promise<void> {
    this.agentProcess = spawn(this.command, ['acp'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    const stdin = this.agentProcess.stdin
    const stdout = this.agentProcess.stdout
    if (!stdin || !stdout) {
      throw new Error('OpenCode ACP process is missing stdio pipes')
    }

    const acpClient = new ACPClient(this.handlers, this.chatId, this.messageStoreHandler)
    this.connection = acp.client({ name: 'intellidb-client' })
      .onRequest(acp.methods.client.session.requestPermission, (ctx) =>
        acpClient.requestPermission(ctx.params),
      )
      .onNotification(acp.methods.client.session.update, (ctx) =>
        acpClient.sessionUpdate(ctx.params),
      )
      .connect(acp.ndJsonStream(
        Writable.toWeb(stdin) as unknown as WritableStream<Uint8Array>,
        Readable.toWeb(stdout) as unknown as ReadableStream<Uint8Array>,
      ))

    let onSpawnError: (error: Error) => void = () => undefined
    const spawnFailed = new Promise<never>((_, reject) => {
      onSpawnError = reject
    })
    this.agentProcess.once('error', onSpawnError)

    await Promise.race([
      this.connection.agent.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
      }),
      spawnFailed,
    ])

    // OpenCode rejects a relative cwd.
    const cwd = path.resolve(process.cwd())
    if (this.existingSessionId) {
      await this.connection.agent.request(acp.methods.agent.session.load, {
        sessionId: this.existingSessionId,
        cwd,
        mcpServers: this.mcpServers,
      })
      this.sessionId = this.existingSessionId
      return
    }

    const created: acp.NewSessionResponse = await this.connection.agent.request(
      acp.methods.agent.session.new,
      {
        cwd,
        mcpServers: this.mcpServers,
      },
    )
    this.sessionId = created.sessionId
  }

  async applyTurn(config: TurnConfig): Promise<void> {
    if (config.provider !== 'opencode') {
      throw new Error('OpenCode cannot apply a Cursor turn')
    }
    const afterModel = await this.setConfigOption('model', config.modelId)
    if (config.variant === undefined) {
      return
    }
    if (!Array.isArray(afterModel.configOptions)) {
      throw new Error('OpenCode did not return config options after setting the model')
    }
    const effort = afterModel.configOptions.find((option) =>
      option.category === 'thought_level' && option.type === 'select',
    )
    if (!effort || effort.type !== 'select' || !flatConfigValues(effort).includes(config.variant)) {
      throw new Error(`OpenCode has no effort option for ${config.variant} on ${config.modelId}`)
    }
    await this.setConfigOption(effort.id, config.variant)
  }

  private setConfigOption(configId: string, value: string): Promise<acp.SetSessionConfigOptionResponse> {
    if (!this.connection) {
      throw new Error('OpenCode is not connected')
    }
    return this.connection.agent.request(acp.methods.agent.session.setConfigOption, {
      sessionId: this.sessionId,
      configId,
      value,
    })
  }

  async sendMessage(text: string): Promise<acp.PromptResponse> {
    if (!this.connection) {
      throw new Error('OpenCode is not connected')
    }
    return this.connection.agent.request(acp.methods.agent.session.prompt, {
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    })
  }

  async cancel(): Promise<void> {
    if (!this.connection) {
      throw new Error('OpenCode is not connected')
    }
    await this.connection.agent.notify(acp.methods.agent.session.cancel, {
      sessionId: this.sessionId,
    })
  }

  dispose(): void {
    this.agentProcess?.kill()
  }
}
