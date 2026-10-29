import { Brain } from 'lucide-react'
import type ChatActivity from '@/interfaces/ChatActivity'

export default function AgentThoughtActivity({
  entry,
}: {
  entry: Extract<ChatActivity, { kind: 'agent_thought' }>
}) {
  return (
    <div className="flex items-start gap-2 self-start rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-sm italic text-muted-foreground">
      <Brain className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p className="whitespace-pre-wrap">{entry.text}</p>
    </div>
  )
}
