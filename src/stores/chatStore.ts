import { create } from 'zustand'
import ChatState from '@/interfaces/ChatState'

const useChatStore = create<ChatState>((set) => ({
  chatsByConnection: {},

  setChats: (connectionId, chats) =>
    set((state) => ({
      chatsByConnection: { ...state.chatsByConnection, [connectionId]: chats },
    })),

  renameChat: (connectionId, chatId, name) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        [connectionId]: (state.chatsByConnection[connectionId] ?? []).map((chat) =>
          chat.id === chatId ? { ...chat, name } : chat,
        ),
      },
    })),

  removeChat: (connectionId, chatId) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        [connectionId]: (state.chatsByConnection[connectionId] ?? []).filter(
          (chat) => chat.id !== chatId,
        ),
      },
    })),
}))

export default useChatStore
