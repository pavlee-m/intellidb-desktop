import type ChatActivity from '@/interfaces/ChatActivity'

export default function UserActivity({
  entry,
}: {
  entry: Extract<ChatActivity, { kind: 'user' }>
}) {
  return (
    <div className="max-w-[80%] self-end whitespace-pre-wrap rounded-lg bg-muted px-3 py-2">
      {entry.text}
    </div>
  )
}
