import { Wrench } from 'lucide-react'
import type ChatActivity from '@/interfaces/ChatActivity'

type ToolStatus = NonNullable<Extract<ChatActivity, { kind: 'tool' }>['status']>

const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
}

export default function ToolActivity({
  entry,
}: {
  entry: Extract<ChatActivity, { kind: 'tool' }>
}) {
  return (
    <div className="inline-flex items-center gap-2 self-start rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm">
      <Wrench className="size-3.5 shrink-0" aria-hidden />
      <span>{entry.text}</span>
      {entry.status ? (
        <span
          className={`rounded-full bg-muted px-1.5 py-0.5 text-xs ${
            entry.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {TOOL_STATUS_LABELS[entry.status]}
        </span>
      ) : null}
    </div>
  )
}
