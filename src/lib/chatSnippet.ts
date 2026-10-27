export const SNIPPET_MAX_LENGTH = 160

export function cutSnippet(
  messageText: string,
  matchStart: number,
  matchLength: number,
): string {
  const textLength = messageText.length
  if (textLength === 0) {
    return ''
  }

  let from: number
  let to: number

  if (matchStart < 0 || matchStart >= textLength) {
    from = 0
    to = Math.min(SNIPPET_MAX_LENGTH, textLength)
  } else {
    const matchEnd = Math.min(textLength, matchStart + Math.max(0, matchLength))
    const matchSpan = matchEnd - matchStart
    if (matchSpan >= SNIPPET_MAX_LENGTH) {
      from = matchStart
      to = Math.min(textLength, matchStart + SNIPPET_MAX_LENGTH)
    } else {
      const extra = SNIPPET_MAX_LENGTH - matchSpan
      const before = Math.floor(extra / 2)
      from = matchStart - before
      to = matchEnd + (extra - before)
      if (from < 0) {
        to = Math.min(textLength, to - from)
        from = 0
      }
      if (to > textLength) {
        from = Math.max(0, from - (to - textLength))
        to = textLength
      }
    }
  }

  const body = messageText.slice(from, to).replace(/\s+/g, ' ')
  const prefix = from > 0 ? '...' : ''
  const suffix = to < textLength ? '...' : ''
  return prefix + body + suffix
}
