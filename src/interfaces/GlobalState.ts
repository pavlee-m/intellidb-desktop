import Model, { ReasoningOption } from "@/lib/Model"

export default interface GlobalState {
  openChatId: number | null
  openByConnectionId: Record<number, boolean>
  selectedModel: Record<number, Model | null>
  reasoning: Record<number, ReasoningOption>
  fast: Record<number, boolean>
  openChat: (chatId: number) => void
  closeChat: () => void
  setConnectionOpen: (connectionId: number, open: boolean) => void
  setSelectedModel: (chatId: number, model: Model | null) => void
  setReasoning: (chatId: number, reasoning: ReasoningOption) => void
  setFast: (chatId: number, fast: boolean) => void
  removeSelectedModel: (chatId: number) => void
  removeReasoning: (chatId: number) => void
  removeFast: (chatId: number) => void
}
