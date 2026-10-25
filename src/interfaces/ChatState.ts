import ChatModel from "@/models/ChatModel"

export default interface ChatState {
  // Missing key: never loaded. Present key (including []): loaded.
  chatsByConnection: Record<number, ChatModel[]>
  addChat: (connectionId: number, chat: ChatModel) => void
  setChats: (connectionId: number, chats: ChatModel[]) => void
  renameChat: (connectionId: number, chatId: number, name: string) => void
  removeChat: (connectionId: number, chatId: number) => void
  setSessionId: (connectionId: number, chatId: number, sessionId: string) => void
  setProvider: (connectionId: number, chatId: number, provider: string) => void
}
