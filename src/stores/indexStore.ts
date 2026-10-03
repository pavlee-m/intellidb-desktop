import { create } from 'zustand'
import IndexState from '@/interfaces/IndexState'

const useIndexStore = create<IndexState>((set) => ({
  openChatId: null,
  openByConnectionId: {},

  openChat: (chatId) => set({ openChatId: chatId }),

  closeChat: () => set({ openChatId: null }),

  setConnectionOpen: (connectionId, open) =>
    set((state) => ({
      openByConnectionId: { ...state.openByConnectionId, [connectionId]: open },
    })),
}))

export default useIndexStore
