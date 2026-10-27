import type { CliProvider } from '@/lib/cliCommand'
import type { TurnConfig } from '@/lib/turnConfig'

export type AgentResult =
  | { ok: true; sessionId: string; provider: CliProvider }
  | {
      ok: false
      provider: CliProvider | null
      sessionId: string | null
      message: string
    }

export interface AgentSession {
  readonly provider: CliProvider
  messageStoreHandler: (chatId: number, messageId: string | null, text: string) => void
  getSessionId(): string
  applyTurn(config: TurnConfig): Promise<void>
  sendMessage(text: string): Promise<unknown>
  cancel(): Promise<void>
  dispose(): void
}
