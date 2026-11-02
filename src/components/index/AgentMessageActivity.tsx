import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type ChatActivity from '@/interfaces/ChatActivity'

export default function AgentMessageActivity({
  entry,
}: {
  entry: Extract<ChatActivity, { kind: 'agent_message' }>
}) {
  return (
    <div className="chat-markdown self-start">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text}</ReactMarkdown>
    </div>
  )
}
