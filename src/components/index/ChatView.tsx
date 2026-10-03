import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import type ChatActivity from '@/interfaces/ChatActivity'
import useChatActivityStore from '@/stores/chatActivityStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import Chat from '@/interfaces/Chat'

interface ChatViewProps {
  chat: Chat
}

// Stable fallback: an inline `?? []` returns a fresh reference per snapshot,
// which useSyncExternalStore treats as a state change and loops forever.
const NO_ENTRIES: ChatActivity[] = []

function ActivityEntry({ entry }: { entry: ChatActivity }) {
  switch (entry.kind) {
    case 'user':
      return (
        <div className="max-w-[80%] self-end whitespace-pre-wrap rounded-lg bg-muted px-3 py-2">
          {entry.text}
        </div>
      )
    case 'agent_message':
      return <div className="self-start whitespace-pre-wrap">{entry.text}</div>
    case 'agent_thought':
      return (
        <div className="self-start text-sm italic text-muted-foreground">
          {entry.text}
        </div>
      )
    case 'tool':
      return (
        <div className="self-start text-sm">
          {entry.text}
          {entry.status ? (
            <span className="text-xs text-muted-foreground"> ({entry.status})</span>
          ) : null}
        </div>
      )
    case 'plan':
      return (
        <div className="self-start whitespace-pre-wrap text-sm">{entry.text}</div>
      )
    default: {
      const _exhaustive: never = entry.kind
      return _exhaustive
    }
  }
}

export default function ChatView({ chat }: ChatViewProps) {
  const entries = useChatActivityStore(
    (state) => state.activityByChatId[chat.id] ?? NO_ENTRIES,
  )
  const pushUserMessage = useChatActivityStore((state) => state.pushUserMessage)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [stubValue, setStubValue] = useState<string>()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [entries])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isSending) return
    setIsSending(true)
    setInput('')
    pushUserMessage(chat.id, text)
    try {
      await window.agentApi.prompt(chat.id, text)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Messages will appear here.</p>
        ) : (
          entries.map((entry, index) => (
            <ActivityEntry
              key={entry.key || `${entry.kind}-${index}`}
              entry={entry}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3">
        <Textarea
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="dangerous-queries" defaultChecked={false} />
              <Label htmlFor="dangerous-queries">Dangerous queries</Label>
            </div>
            <Select value={stubValue} onValueChange={setStubValue}>
              <SelectTrigger>
                <SelectValue placeholder="Stub" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option-a">Option A</SelectItem>
                <SelectItem value="option-b">Option B</SelectItem>
                <SelectItem value="option-c">Option C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={!input.trim() || isSending}
            onClick={() => {
              void handleSend()
            }}
          >
            <Send />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
