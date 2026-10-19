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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import useGlobalStore from '@/stores/globalStore'
import useBackendConnectionStore from '@/stores/backendConnectionStore'
import { Spinner } from '@/components/ui/spinner'
import {
  OPENCODE_STUB_MODELS,
} from '@/lib/opencodeStubModels'
import { getProviderCliCommand } from '@/lib/cliCommand'
import Model, { ReasoningOption } from '@/interfaces/Model'
import useSettingsStore from '@/stores/settingsStore'

function choiceKey(model: Model): string {
  return `${model.provider}:${model.id}`
}

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
  const [cursorModels, setCursorModels] = useState<Model[]>([])
  const selectedModel = useGlobalStore((state) => state.selectedModel[chatId])
  const reasoning = useGlobalStore((state) => state.reasoning[chatId])
  const fast = useGlobalStore((state) => state.fast[chatId])
  const dangerousQueries = useGlobalStore((state) => state.dangerousQueries[chatId])
  const setSelectedModel = useGlobalStore((state) => state.setSelectedModel)
  const setReasoning = useGlobalStore((state) => state.setReasoning)
  const setFast = useGlobalStore((state) => state.setFast)
  const removeSelectedModel = useGlobalStore((state) => state.removeSelectedModel)
  const removeReasoning = useGlobalStore((state) => state.removeReasoning)
  const removeFast = useGlobalStore((state) => state.removeFast)
  const removeDangerousQueries = useGlobalStore((state) => state.removeDangerousQueries)
  const settings = useSettingsStore((state) => state.settings)
  const setSettings = useSettingsStore((state) => state.setSettings)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sendInFlightRef = useRef(false)
  const addChat = useChatStore((state) => state.addChat)
  const removeChat = useChatStore((state) => state.removeChat)
  const setSessionId = useChatStore((state) => state.setSessionId)
  const setProvider = useChatStore((state) => state.setProvider)
  const setDangerousQueries = useGlobalStore((state) => state.setDangerousQueries)
  const setConnectionOpen = useGlobalStore((state) => state.setConnectionOpen)
  const openChat = useGlobalStore((state) => state.openChat)
  const backendConnections = useBackendConnectionStore((state) => state.backendConnections)
  const backendConnectionId = backendConnections.find(
    ({ connection }) => connection.id === currentChat?.connectionId,
  )?.backendConnectionId;
  const isConnectionOnline = Boolean(
    backendConnections.find(
      ({ connection }) => connection.id === currentChat?.connectionId,
    )?.backendConnectionId,
  )
  const mode = isSending ? 'stop' : 'send'
  const isWaitingForActivity = waitForInitialActivity

  const catalog: Model[] = [
    ...(settings?.cursor_cli_integration_enabled ? cursorModels : []),
    ...(settings?.opencode_integration_enabled ? OPENCODE_STUB_MODELS : []),
  ]
  const lockedProvider = currentChat?.provider ?? ''
  const visibleModels = lockedProvider
    ? catalog.filter((model) => model.provider === lockedProvider)
    : catalog

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [entries])

  useEffect(() => {
    return window.agentApi.onActivity((activityChatId) => {
      if (activityChatId === chatId) setWaitForInitialActivity(false)
    })
  }, [chatId])

  useEffect(() => {
    // Get model from store, if no set, set first model from visibleModels.
    // visibleModels can be empty while settings/models are still loading
    // (or if the locked provider has no models in the catalog), so only
    // default once there is actually a model available.
    if (!selectedModel && visibleModels.length > 0) {
      const model = visibleModels[0]
      setSelectedModel(chatId, model)
      setReasoning(chatId, model.reasoningOptions[0] ?? '')
      setFast(chatId, false)
    }
  }, [chatId, selectedModel, visibleModels])

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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const loaded = settings ?? await window.settingsApi.getSettings()
      if (!settings) {
        setSettings(loaded)
        return
      }
      if (cancelled) {
        return
      }
      if (!loaded.cursor_cli_integration_enabled) {
        setCursorModels([])
        return
      }
      try {
        const rows = await window.modelsApi.listCursor()
        if (cancelled) {
          return
        }
        setCursorModels(rows.map((row) => ({
          provider: 'cursor',
          id: row.id,
          name: row.name,
          reasoningOptions: [...row.reasoningOptions],
          hasFast: row.hasFast,
        })))
      } catch (error) {
        if (!cancelled) {
          setCursorModels([])
          toast.error(error instanceof Error ? error.message : String(error))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [settings, setSettings])


  const handleModelChange = (nextKey: string) => {
    const next = visibleModels.find((model) => choiceKey(model) === nextKey)
    if (!next) return;
    setSelectedModel(chatId, next ?? visibleModels[0])
    setReasoning(chatId, next?.reasoningOptions[0] ?? '')
    setFast(chatId, false)
  }

  const handleSend = async () => {
    if (sendInFlightRef.current) return
    sendInFlightRef.current = true
    try {
      if (!isConnectionOnline) return
      const text = input.trim()
      if (!text || isSending) return
      if (currentChat && currentChat.id === -1) {
        if (!selectedModel) {
          toast.error('Select a model before sending')
          return
        }
        const loadedSettings = settings ?? await window.settingsApi.getSettings()
        const command = getProviderCliCommand(selectedModel.provider, loadedSettings)
        try {
          const check = await window.settingsApi.checkCliCommand(command)
          if (check.ok === false) {
            toast.error(check.message)
            return
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error))
          return
        }
      }
      if (selectedModel?.provider === 'opencode') {
        toast.error('OpenCode is not connected yet')
        return
      }

      let chat = currentChat
      if (chat && chat.id === -1) {
        const newChat = await createChat(chat.connectionId)
        if (!newChat) return
        // Swap the -1 placeholder for the persisted chat: drop the placeholder,
        // select the real one, and keep using it for the rest of this send.
        removeChat(newChat.connectionId, -1)
        let existingSelectedModel: Model | null = selectedModel;
        let existingReasoning: ReasoningOption = reasoning;
        let existingFast: boolean = fast;
        const existingDangerousQueries = dangerousQueries ?? false;
        removeSelectedModel(-1);
        removeReasoning(-1);
        removeFast(-1);
        removeDangerousQueries(-1);
        setSelectedModel(newChat.id, existingSelectedModel);
        setReasoning(newChat.id, existingReasoning);
        setFast(newChat.id, existingFast);
        setDangerousQueries(newChat.id, existingDangerousQueries);
        openChat(newChat.id)
        await handleAgentConnect(newChat)
        // Update the name in the database
        await window.chatsApi.renameChat(newChat.id, text)
        newChat.name = text;
        chat = newChat;
      }
      if (!chat) return

      setIsSending(true)
      setInput('')
      pushUserMessage(chat.id, text)
      try {
        if (selectedModel && !chat.provider) {
          await window.chatsApi.setProvider(chat.id, selectedModel.provider)
          setProvider(chat.connectionId, chat.id, selectedModel.provider)
        }
        if (selectedModel?.provider === 'cursor') {
          await window.agentApi.applyModel(chat.id, {
            modelId: selectedModel.id,
            reasoning: reasoning || undefined,
            fast: selectedModel.hasFast && fast,
          })
        }
        let agentQuery = `dangerousQueries: ${dangerousQueries ?? false}\nconnectionId: ${backendConnectionId ?? 'unknown'}\n${text}`;
        await window.agentApi.prompt(chat.id, agentQuery)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
      } finally {
        setIsSending(false)
      }
    } finally {
      sendInFlightRef.current = false
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
      className={!isConnectionOnline
        ? 'pointer-events-none border-0 shadow-none focus-visible:ring-0'
        : 'border-0 shadow-none focus-visible:ring-0'}
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
        <div className="rounded-lg border border-input">
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
          <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Select
              value={selectedModel ? choiceKey(selectedModel) : undefined}
              onValueChange={handleModelChange}
              disabled={visibleModels.length === 0}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {(['cursor', 'opencode'] as const).map((provider) => {
                  const group = visibleModels.filter((model) => model.provider === provider)
                  if (group.length === 0) {
                    return null
                  }
                  return (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider === 'cursor' ? 'Cursor' : 'OpenCode'}</SelectLabel>
                      {group.map((model) => (
                        <SelectItem key={choiceKey(model)} value={choiceKey(model)}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )
                })}
              </SelectContent>
            </Select>
            <Select
              value={reasoning || undefined}
              onValueChange={(value) => setReasoning(chatId, value as ReasoningOption)}
              disabled={!selectedModel || selectedModel.reasoningOptions.length === 0}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder="Reasoning" />
              </SelectTrigger>
              <SelectContent>
                {selectedModel?.reasoningOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModel?.hasFast ? (
              <div className="flex items-center gap-2">
                <Switch id="model-fast" checked={fast} onCheckedChange={(checked) => setFast(chatId, checked)} />
                <Label htmlFor="model-fast">Fast</Label>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Switch
                id="dangerous-queries"
                checked={dangerousQueries ?? false}
                onCheckedChange={(checked) => setDangerousQueries(chatId, checked)}
              />
              <Label htmlFor="dangerous-queries">Dangerous queries</Label>
            </div>
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
    </div>
  )
}
