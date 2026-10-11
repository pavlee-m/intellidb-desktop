import { create } from 'zustand'
import Chat from '@/interfaces/Chat'
import ChatState from '@/interfaces/ChatState'

const withDangerousQueriesDefault = (chat: Chat): Chat => ({
  ...chat,
  dangerousQueries: chat.dangerousQueries ?? false,
})

const useChatStore = create<ChatState>((set) => ({
  chatsByConnection: {},

  addChat: (connectionId, chat) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        // Appending also creates the key if it was missing, which marks the
        // connection's chats as loaded per the ChatState convention.
        [connectionId]: [
          ...(state.chatsByConnection[connectionId] ?? []),
          withDangerousQueriesDefault(chat),
        ],
      },
    })),

  setChats: (connectionId, chats) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        [connectionId]: chats.map(withDangerousQueriesDefault),
      },
    })),

  renameChat: (connectionId, chatId, name) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        [connectionId]: (state.chatsByConnection[connectionId] ?? []).map((chat) =>
          chat.id === chatId
            ? { ...chat, name }
            : chat,
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

  setSessionId: (connectionId, chatId, sessionId) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        [connectionId]: (state.chatsByConnection[connectionId] ?? []).map((chat) =>
          chat.id === chatId ? { ...chat, sessionId } : chat,
        ),
      },
    })),

  setProvider: (connectionId, chatId, provider) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        [connectionId]: (state.chatsByConnection[connectionId] ?? []).map((chat) =>
          chat.id === chatId ? { ...chat, provider } : chat,
        ),
      },
    })),

  setDangerousQueries: (connectionId, chatId, dangerousQueries) =>
    set((state) => ({
      chatsByConnection: {
        ...state.chatsByConnection,
        [connectionId]: (state.chatsByConnection[connectionId] ?? []).map((chat) =>
          chat.id === chatId ? { ...chat, dangerousQueries } : chat,
        ),
      },
    })),
}))

export default useChatStore
