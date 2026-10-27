import type ChatModel from '@/models/ChatModel'

export default interface ChatSearchHit {
  chat: ChatModel
  snippet: string
}
