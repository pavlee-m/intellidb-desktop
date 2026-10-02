import Chat from '@/interfaces/Chat'

export default interface ChatState {
  // Missing key: never loaded. Present key (including []): loaded.
  chatsByConnection: Record<number, Chat[]>
  setChats: (connectionId: number, chats: Chat[]) => void
  renameChat: (connectionId: number, chatId: number, name: string) => void
  removeChat: (connectionId: number, chatId: number) => void
}
