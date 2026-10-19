import Model, { ReasoningOption } from "@/interfaces/Model"

export default interface GlobalState {
  openChatId: number | null
  openByConnectionId: Record<number, boolean>
  selectedModel: Record<number, Model | null>
  reasoning: Record<number, ReasoningOption>
  fast: Record<number, boolean>
  dangerousQueries: Record<number, boolean>
  openChat: (chatId: number) => void
  closeChat: () => void
  setConnectionOpen: (connectionId: number, open: boolean) => void
  setSelectedModel: (chatId: number, model: Model | null) => void
  setReasoning: (chatId: number, reasoning: ReasoningOption) => void
  setFast: (chatId: number, fast: boolean) => void
  setDangerousQueries: (chatId: number, dangerousQueries: boolean) => void
  removeSelectedModel: (chatId: number) => void
  removeReasoning: (chatId: number) => void
  removeFast: (chatId: number) => void
  removeDangerousQueries: (chatId: number) => void
}
