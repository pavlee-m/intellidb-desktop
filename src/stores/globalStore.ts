import { create } from 'zustand'
import GlobalState from '@/interfaces/GlobalState'
import { ChatProperties } from '@/interfaces/ChatProperties'

const useGlobalStore = create<GlobalState>((set, get) => ({
  openChatId: null,
  openByConnectionId: {},
  chatProperties: {},

  openChat: (chatId) => set({ openChatId: chatId }),

  closeChat: () => set({ openChatId: null }),

  setChatProperties: (chatId: number, chatProperties: ChatProperties) => set({ chatProperties: { ...get().chatProperties, [chatId]: chatProperties } }),

  // Atomically patch one chat's properties; a no-op if not initialized yet.
  updateChatProperties: (chatId: number, patch: Partial<ChatProperties>) => set((state) => {
    const existing = state.chatProperties[chatId]
    if (!existing) return state
    return { chatProperties: { ...state.chatProperties, [chatId]: { ...existing, ...patch } } }
  }),

  setConnectionOpen: (connectionId: number, open: boolean) => set({ openByConnectionId: { ...get().openByConnectionId, [connectionId]: open } }),

  deleteChatProperties: (chatId: number) => set((state) => {
    const { [chatId]: _removed, ...rest } = state.chatProperties
    return { chatProperties: rest }
  }),
}))

export default useGlobalStore
