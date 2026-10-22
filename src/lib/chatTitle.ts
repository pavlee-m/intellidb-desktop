const MAX_INITIAL_CHAT_TITLE_LENGTH = 20
const INITIAL_CHAT_TITLE_ELLIPSIS = '...'

export function deriveInitialChatTitle(question: string): string {
  const normalized = question.trim().replace(/\s+/g, ' ')
  if (normalized.length <= MAX_INITIAL_CHAT_TITLE_LENGTH) return normalized
  const bodyLength = MAX_INITIAL_CHAT_TITLE_LENGTH - INITIAL_CHAT_TITLE_ELLIPSIS.length
  return normalized.slice(0, bodyLength) + INITIAL_CHAT_TITLE_ELLIPSIS
}
