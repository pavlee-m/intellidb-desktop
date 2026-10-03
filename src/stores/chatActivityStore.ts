import { create } from 'zustand'
import ChatActivity from '@/interfaces/ChatActivity'

interface ChatActivityState {
  activityByChatId: Record<number, ChatActivity[]>
  pushUserMessage: (chatId: number, text: string) => void
  applyAgentUpdate: (chatId: number, entry: ChatActivity) => void
}

let activityKeyCounter = 0

function nextActivityKey(): string {
  activityKeyCounter += 1
  return `a${activityKeyCounter}`
}

const useChatActivityStore = create<ChatActivityState>((set) => ({
  activityByChatId: {},

  pushUserMessage: (chatId, text) =>
    set((state) => ({
      activityByChatId: {
        ...state.activityByChatId,
        [chatId]: [
          ...(state.activityByChatId[chatId] ?? []),
          { key: nextActivityKey(), kind: 'user', text },
        ],
      },
    })),

  applyAgentUpdate: (chatId, entry) => 
    set((state) => {
      console.log(chatId, entry);
      const current = state.activityByChatId[chatId] ?? []
      const last = current[current.length - 1]
      let next: ChatActivity[]

      if (
        (entry.kind === 'agent_message' || entry.kind === 'agent_thought') &&
        last &&
        last.kind === entry.kind
      ) {
        next = [
          ...current.slice(0, -1),
          { ...last, text: last.text + entry.text },
        ]
      } else if (entry.kind === 'tool') {
        const existingIndex = current.findIndex((item) => item.key === entry.key)
        next =
          existingIndex === -1
            ? [...current, entry]
            : current.map((item, index) => (index === existingIndex ? entry : item))
      } else if (entry.kind === 'plan') {
        const existingIndex = current.findIndex((item) => item.key === 'plan')
        next =
          existingIndex === -1
            ? [...current, entry]
            : current.map((item, index) => (index === existingIndex ? entry : item))
      } else {
        next = [...current, entry]
      }
      const newState = {
        activityByChatId: {
          ...state.activityByChatId,
          [chatId]: next,
        },
      }
      console.log('chatActivityStore after update:', newState.activityByChatId[chatId])
      return newState

      }),
}))

export default useChatActivityStore
