import { create } from 'zustand'
import GlobalState from '@/interfaces/GlobalState'

const useGlobalStore = create<GlobalState>((set, get) => ({
  openChatId: null,
  openByConnectionId: {},
  selectedModeId: {},
  selectedModel: {},
  reasoning: {},
  fast: {},
  dangerousQueries: {},

  openChat: (chatId) => set({ openChatId: chatId }),

  closeChat: () => set({ openChatId: null }),

  setConnectionOpen: (connectionId, open) =>
    set((state) => ({
      openByConnectionId: { ...state.openByConnectionId, [connectionId]: open },
    })),

  setSelectedModel: (chatId, model) =>
    set((state) => ({
      selectedModel: { ...state.selectedModel, [chatId]: model },
    })),

  setReasoning: (chatId, reasoning) =>
    set((state) => ({
      reasoning: { ...state.reasoning, [chatId]: reasoning },
    })),

  setFast: (chatId, fast) =>
    set((state) => ({
      fast: { ...state.fast, [chatId]: fast },
    })),

  setDangerousQueries: (chatId, dangerousQueries) =>
    set((state) => ({
      dangerousQueries: { ...state.dangerousQueries, [chatId]: dangerousQueries },
    })),

  removeSelectedModel: (chatId) =>
    set((state) => {
      const { [chatId]: _, ...selectedModel } = state.selectedModel
      return { selectedModel }
    }),

  removeReasoning: (chatId) =>
    set((state) => {
      const { [chatId]: _, ...reasoning } = state.reasoning
      return { reasoning }
    }),

  removeFast: (chatId) =>
    set((state) => {
      const { [chatId]: _, ...fast } = state.fast
      return { fast }
    }),

  removeDangerousQueries: (chatId) =>
    set((state) => {
      const { [chatId]: _, ...dangerousQueries } = state.dangerousQueries
      return { dangerousQueries }
    }),
}))

export default useGlobalStore
