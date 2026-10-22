import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plug, Send, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
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
import { ChatProperties } from '@/interfaces/ChatProperties'
import useChatStore from '@/stores/chatStore'
import useGlobalStore from '@/stores/globalStore'
import useBackendConnectionStore from '@/stores/backendConnectionStore'
import useModelsStore from '@/stores/modelsStore'
import { Spinner } from '@/components/ui/spinner'
import {
  OPENCODE_STUB_MODELS,
} from '@/lib/opencodeStubModels'
import { getProviderCliCommand, type CliProvider } from '@/lib/cliCommand'
import { useProviderReadiness } from '@/lib/providerReadiness'
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
      return (
        <div className="chat-markdown self-start">
          <ReactMarkdown>{entry.text}</ReactMarkdown>
        </div>
      )
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
  const chatProperties = useGlobalStore((state) => state.chatProperties[chatId]);
  const allModels = useModelsStore((state) => state.models)
  const setAllModels = useModelsStore((state) => state.setModels)
  const settings = useSettingsStore((state) => state.settings)
  const setSettings = useSettingsStore((state) => state.setSettings)
  const setChatProperties = useGlobalStore((state) => state.setChatProperties)
  const updateChatProperties = useGlobalStore((state) => state.updateChatProperties)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sendInFlightRef = useRef(false)
  const addChat = useChatStore((state) => state.addChat)
  const removeChat = useChatStore((state) => state.removeChat)
  const setSessionId = useChatStore((state) => state.setSessionId)
  const setProvider = useChatStore((state) => state.setProvider)
  const setConnectionOpen = useGlobalStore((state) => state.setConnectionOpen)
  const deleteChatProperties = useGlobalStore((state) => state.deleteChatProperties)
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

  const lockedProvider: '' | CliProvider =
    currentChat?.provider === 'cursor' || currentChat?.provider === 'opencode'
      ? currentChat.provider
      : ''
  const providerReadiness = useProviderReadiness(lockedProvider)
  const providerBlocked =
    providerReadiness.status === 'no-provider' ||
    providerReadiness.status === 'cli-unavailable'
  const composerTooltip = !isConnectionOnline
    ? 'Connection is not active'
    : providerBlocked
      ? providerReadiness.message
      : null
  const modelPlaceholder =
    providerReadiness.status === 'no-provider'
      ? 'No provider configured'
      : providerReadiness.status === 'cli-unavailable'
        ? 'Model provider not configured'
        : 'Model'
  // Memoized so `visibleModels` stays referentially stable; otherwise the
  // properties-init effect below would run after every render.
  const visibleModels = useMemo(() => {
    const catalog: Model[] = [
      ...(settings?.cursor_cli_integration_enabled ? allModels : []),
      ...(settings?.opencode_integration_enabled ? OPENCODE_STUB_MODELS : []),
    ]
    return lockedProvider
      ? catalog.filter((model) => model.provider === lockedProvider)
      : catalog
  }, [settings, allModels, lockedProvider])


  // Single source of truth for a freshly-selected model's defaults.
   const createChatProperties = (model: Model): ChatProperties => {
      return {
          model,
          reasoning: model.reasoningOptions[0],
          fast: false,
          dangerousQueries: false,
      }
  }


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [entries])

  useEffect(() => {
    return window.agentApi.onActivity((activityChatId) => {
      if (activityChatId === chatId) setWaitForInitialActivity(false)
    })
  }, [chatId])

  useEffect(() => {
    // Default to the first available model once one exists.
    // visibleModels can be empty while settings/models are still loading
    // (or if the locked provider has no models in the catalog), so only
    // default once there is actually a model available.
    if (!chatProperties && visibleModels.length > 0) {
      setChatProperties(chatId, createChatProperties(visibleModels[0]))
    }
  }, [chatId, chatProperties, visibleModels])

  useEffect(() => {
    // Having entries in mind here is important
    // Otherwise, opening the chat, opening the settings, coming back, the spin animation shows forever
    setWaitForInitialActivity(chatId !== -1 && entries.length === 0)
  }, [chatId])

  useEffect(() => {
    if (currentChat && currentChat.id !== -1) {
      handleAgentConnect(currentChat);
    }
  }, [currentChat?.id, isConnectionOnline])

  const loadModels = async () => {
    // Load cursor models
    try{
      const cursorModels = await window.modelsApi.listCursor()
      const opencodeModels = OPENCODE_STUB_MODELS
      let allModels: Model[] = []
      for (const model of cursorModels) {
        allModels.push({
          provider: 'cursor',
          id: model.id,
          name: model.name,
          reasoningOptions: [...model.reasoningOptions],
          hasFast: model.hasFast,
        })
      }
      for (const model of opencodeModels) {
        allModels.push({
          provider: 'opencode',
          id: model.id,
          name: model.name,
          reasoningOptions: [...model.reasoningOptions],
          hasFast: model.hasFast,
        })
      }
      setAllModels(allModels)
    }
    catch (error) {
      if (!providerBlocked) {
        toast.error(error instanceof Error ? error.message : String(error))
      }
    }
  }

  useEffect(() => {
    if (allModels.length === 0) {
      // try loading models
      loadModels()
    }
  }, [chatId, settings])


  const handleModelChange = (nextKey: string) => {
    const next = visibleModels.find((model) => choiceKey(model) === nextKey)
    if (!next) return
    // One atomic update: new model, its first reasoning option, fast reset.
    updateChatProperties(chatId, { model: next, reasoning: next.reasoningOptions[0], fast: false })
  }

  const handleSend = async () => {
    if (sendInFlightRef.current) return
    sendInFlightRef.current = true
    try {
      if (!isConnectionOnline) return
      if (providerBlocked) return
      const text = input.trim()
      if (!text || isSending) return
      // Snapshot the current properties: after openChat(newChat.id) below the
      // component re-renders for the new chatId, but this closure keeps
      // operating on the selection made for the placeholder chat.
      const props = chatProperties
      if (currentChat && currentChat.id === -1) {
        if (!props?.model) {
          toast.error('Select a model before sending')
          return
        }
        const loadedSettings = settings ?? await window.settingsApi.getSettings()
        const command = getProviderCliCommand(props.model.provider, loadedSettings)
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
      if (props?.model?.provider === 'opencode') {
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
        deleteChatProperties(-1);
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
        if (props?.model && !chat.provider) {
          await window.chatsApi.setProvider(chat.id, props.model.provider)
          setProvider(chat.connectionId, chat.id, props.model.provider)
        }
        if (props?.model?.provider === 'cursor' && props.model) {
          await window.agentApi.applyModel(chat.id, {
            modelId: props.model.id,
            reasoning: props.reasoning,
            fast: props.model.hasFast && props.fast === true,
          })
        }
        const agentQuery = `dangerousQueries: ${props?.dangerousQueries ?? false}\nconnectionId: ${backendConnectionId ?? 'unknown'}\n${text}`;
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
      disabled={!isConnectionOnline || isWaitingForActivity || providerBlocked}
      className={composerTooltip
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
      disabled={mode === 'send' && (!input.trim() || !isConnectionOnline || isWaitingForActivity || providerBlocked)}
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
        {providerBlocked ? (
          <div className="mb-3 flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground" role="status">
              {providerReadiness.message}
            </p>
            <Button asChild className="justify-start" size="sm" variant="outline">
              <Link to="/settings/integrations">
                <Plug className="h-4 w-4" />
                <span>Settings → Integrations</span>
              </Link>
            </Button>
          </div>
        ) : null}
        <div className="rounded-lg border border-input">
          {composerTooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-not-allowed">{composer}</div>
                </TooltipTrigger>
                <TooltipContent>{composerTooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            composer
          )}
          <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Select
              value={providerBlocked ? undefined : (chatProperties?.model ? choiceKey(chatProperties.model) : undefined)}
              onValueChange={handleModelChange}
              disabled={visibleModels.length === 0 || providerBlocked}
            >
              <SelectTrigger size="sm" className={providerBlocked ? 'w-60' : 'w-44'}>
                <SelectValue placeholder={modelPlaceholder} />
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
              value={chatProperties?.reasoning || undefined}
              onValueChange={(value) => updateChatProperties(chatId, { reasoning: value as ReasoningOption })}
              disabled={!chatProperties?.model || chatProperties.model.reasoningOptions.length === 0}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder="Reasoning" />
              </SelectTrigger>
              <SelectContent>
                {chatProperties?.model?.reasoningOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chatProperties?.model?.hasFast ? (
              <div className="flex items-center gap-2">
                <Switch id="model-fast" checked={chatProperties?.fast ?? false} onCheckedChange={(checked) => updateChatProperties(chatId, { fast: checked })} />
                <Label htmlFor="model-fast">Fast</Label>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Switch
                id="dangerous-queries"
                checked={chatProperties?.dangerousQueries ?? false}
                onCheckedChange={(checked) => updateChatProperties(chatId, { dangerousQueries: checked })}
              />
              <Label htmlFor="dangerous-queries">Dangerous queries</Label>
            </div>
          </div>
          {mode === 'send' && composerTooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-not-allowed">{sendStopButton}</span>
                </TooltipTrigger>
                <TooltipContent>{composerTooltip}</TooltipContent>
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
