import ReactMarkdown from 'react-markdown'
import type ChatActivity from '@/interfaces/ChatActivity'

export default function AgentMessageActivity({
  entry,
}: {
  entry: Extract<ChatActivity, { kind: 'agent_message' }>
}) {
  return (
    <div className="chat-markdown self-start">
      <ReactMarkdown>{entry.text}</ReactMarkdown>
    </div>
  )
}
