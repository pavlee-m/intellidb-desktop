import Chat from './Chat'

export default interface ChatState {
  // Missing key: never loaded. Present key (including []): loaded.
  chatsByConnection: Record<number, Chat[]>
  addChat: (connectionId: number, chat: Chat) => void
  setChats: (connectionId: number, chats: Chat[]) => void
  renameChat: (connectionId: number, chatId: number, name: string) => void
  removeChat: (connectionId: number, chatId: number) => void
  setSessionId: (connectionId: number, chatId: number, sessionId: string) => void
  setProvider: (connectionId: number, chatId: number, provider: string) => void
}
