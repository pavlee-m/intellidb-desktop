import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import Chat from '@/interfaces/Chat'
import useChatStore from '@/stores/chatStore'
import useIndexStore from '@/stores/indexStore'
import useBackendConnectionStore from '@/stores/backendConnectionStore'
import { Spinner } from '@/components/ui/spinner'

interface ChatViewProps {
  chatId: number
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

export default function ChatView({ chatId }: ChatViewProps) {
  // chatsByConnection is keyed by connectionId, so we can't index by chatId;
  // scan the values and match on chat.id instead.
  const currentChat: Chat | undefined = useChatStore((state) =>
    Object.values(state.chatsByConnection)
      .flat()
      .find((chat) => chat.id === chatId),
  )
  const entries = useChatActivityStore(
    (state) => state.activityByChatId[chatId] ?? NO_ENTRIES,
  )
  const pushUserMessage = useChatActivityStore((state) => state.pushUserMessage)
  const [waitForInitialActivity, setWaitForInitialActivity] = useState(chatId === -1 ? false: true)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [stubValue, setStubValue] = useState<string>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const addChat = useChatStore((state) => state.addChat)
  const removeChat = useChatStore((state) => state.removeChat)
  const setSessionId = useChatStore((state) => state.setSessionId)
  const setConnectionOpen = useIndexStore((state) => state.setConnectionOpen)
  const openChat = useIndexStore((state) => state.openChat)
  const backendConnections = useBackendConnectionStore((state) => state.backendConnections)
  const isConnectionOnline = Boolean(
    backendConnections.find(
      ({ connection }) => connection.id === currentChat?.connectionId,
    )?.backendConnectionId,
  )
  const mode = isSending ? 'stop' : 'send'
  const isWaitingForActivity = waitForInitialActivity

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [entries])

  useEffect(() => {
    return window.agentApi.onActivity((activityChatId) => {
      if (activityChatId === chatId) setWaitForInitialActivity(false)
    })
  }, [chatId])

  useEffect(() => {
    // Having entries in mind here is important
    // Otherwise, opening the chat, opening the settings, coming back, the spin animation shows forever
    setWaitForInitialActivity(chatId !== -1 && entries.length === 0)
  }, [chatId])

  useEffect(() => {
    console.log('Chat id', currentChat?.id)
    if (currentChat && currentChat.id !== 1) {
      handleAgentConnect(currentChat);
    }
  }, [currentChat?.id, isConnectionOnline])

  const handleSend = async () => {
    if (!isConnectionOnline) return
    const text = input.trim()
    if (!text || isSending) return

    let chat = currentChat
    if (chat && chat.id === -1) {
      const newChat = await createChat(chat.connectionId)
      if (!newChat) return
      // Swap the -1 placeholder for the persisted chat: drop the placeholder,
      // select the real one, and keep using it for the rest of this send.
      removeChat(newChat.connectionId, -1)
      openChat(newChat.id)
      await handleAgentConnect(newChat)
      chat = newChat
    }
    if (!chat) return

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

  const handleCancel = async () => {
    try {
      await window.agentApi.cancel(chatId);
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : String(error))
    }
    setIsSending(false);
  }

  const createChat = async (connectionId: number): Promise<Chat | null> => {
    try {
      const chat = await window.chatsApi.addChat(connectionId)
      addChat(connectionId, chat)
      setConnectionOpen(connectionId, true)
      return chat
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : String(error))
      return null
    }
  }

  const handleAgentConnect = (chat: Chat) => {
    return window.agentApi.connect(chat.id, chat.sessionId)
      .then((sessionId) => {
        if (sessionId) {
          setSessionId(chat.connectionId, chat.id, sessionId)
        }
        if (chat.id === -1) {
          setWaitForInitialActivity(false)
        }
      })
      .catch((error) => {
        console.error(error)
        toast.error(error instanceof Error ? error.message : String(error))
        setWaitForInitialActivity(false)
      })
  }

  const composer = (
    <Textarea
      rows={2}
      value={input}
      disabled={!isConnectionOnline || isWaitingForActivity}
      className={!isConnectionOnline ? 'pointer-events-none' : undefined}
      onChange={(event) => setInput(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          void handleSend()
        }
      }}
    />
  )

  const sendStopButton = (
    <Button
      type="button"
      disabled={mode === 'send' && (!input.trim() || !isConnectionOnline || isWaitingForActivity)}
      onClick={() => {
        if (mode === 'stop') {
          void handleCancel()
        } else {
          void handleSend()
        }
      }}
    >
      {mode === 'stop' ? <X /> : <Send />}
      {mode === 'stop' ? 'Stop' : 'Send'}
    </Button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isWaitingForActivity ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : (
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
      )}
      <div className="border-t p-3">
        {!isConnectionOnline ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-not-allowed">{composer}</div>
              </TooltipTrigger>
              <TooltipContent>Connection is not active</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          composer
        )}
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
          {mode === 'send' && !isConnectionOnline ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-not-allowed">{sendStopButton}</span>
                </TooltipTrigger>
                <TooltipContent>Connection is not active</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            sendStopButton
          )}
        </div>
      </div>
    </div>
  )
}
