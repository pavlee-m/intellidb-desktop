import { ChatProperties } from "@/interfaces/ChatProperties"

export default interface GlobalState {
  openChatId: number | null
  openByConnectionId: Record<number, boolean>
  chatProperties: Record<number, ChatProperties>
  openChat: (chatId: number) => void
  closeChat: () => void
  setChatProperties: (chatId: number, chatProperties: ChatProperties) => void
  updateChatProperties: (chatId: number, patch: Partial<ChatProperties>) => void
  setConnectionOpen: (connectionId: number, open: boolean) => void
  deleteChatProperties: (chatId: number) => void
}
