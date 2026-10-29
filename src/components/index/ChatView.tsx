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
import ChatModel from '@/models/ChatModel'
import { ChatProperties } from '@/interfaces/ChatProperties'
import { parseSessionMode, SESSION_MODE_OPTIONS } from '@/interfaces/SessionMode'
import useChatStore from '@/stores/chatStore'
import useGlobalStore from '@/stores/globalStore'
import useBackendConnectionStore from '@/stores/backendConnectionStore'
import useModelsStore from '@/stores/modelsStore'
import { Spinner } from '@/components/ui/spinner'
import { getProviderCliCommand, type CliProvider } from '@/lib/cliCommand'
import { useProviderReadiness } from '@/lib/providerReadiness'
import { deriveInitialChatTitle } from '@/lib/chatTitle'
import type { Model } from '@/interfaces/Model'
import { turnConfigFromProperties, type TurnConfig } from '@/lib/turnConfig'
import useSettingsStore from '@/stores/settingsStore'
import type { RequestPermissionRequest } from '@agentclientprotocol/sdk'

function choiceKey(model: Model): string {
  return `${model.provider}:${model.id}`
}

interface ChatViewProps {
  chatId: number
}

// Stable fallback: an inline `?? []` returns a fresh reference per snapshot,
// which useSyncExternalStore treats as a state change and loops forever.
const NO_ENTRIES: ChatActivity[] = []

function processUserMessage(message: string): string {
  const lines = message.split('\n')
  if (lines[0]?.startsWith('dangerousQueries:') && lines[1]?.startsWith('connectionId:')) {
    return lines.slice(2).join('\n')
  }
  return message
}

function ActivityEntry({ entry }: { entry: ChatActivity }) {
  switch (entry.kind) {
    case 'user':
      return (
        <div className="max-w-[80%] self-end whitespace-pre-wrap rounded-lg bg-muted px-3 py-2">
          {processUserMessage(entry.text) || entry.text}
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
      console.log("PLAN!");
      return (
        <div className="self-start whitespace-pre-wrap text-sm">PLAN! {entry.text}</div>
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
  const currentChat: ChatModel | undefined = useChatStore((state) =>
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
  const [permissionRequest, setPermissionRequest] = useState<RequestPermissionRequest | null>(null)
  const chatProperties = useGlobalStore((state) => state.chatProperties[chatId]);
  const allModels = useModelsStore((state) => state.models)
  const settings = useSettingsStore((state) => state.settings)
  const setChatProperties = useGlobalStore((state) => state.setChatProperties)
  const updateChatProperties = useGlobalStore((state) => state.updateChatProperties)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sendInFlightRef = useRef(false)
  const addChat = useChatStore((state) => state.addChat)
  const removeChat = useChatStore((state) => state.removeChat)
  const renameChat = useChatStore((state) => state.renameChat)
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
    const catalog = allModels.filter((model) => {
      if (model.provider === 'cursor') {
        return settings?.cursor_cli_integration_enabled
      }
      return settings?.opencode_integration_enabled
    })
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
          sessionMode: 'agent',
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

  useEffect(() => window.agentApi.onPermissionChange(chatId, setPermissionRequest), [chatId])

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

  const pushLiveConfig = (props: ChatProperties) => {
    if (chatId === -1) return
    let config: TurnConfig
    try {
      const built = turnConfigFromProperties(props)
      if (!built) return
      config = built
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return
    }
    void window.agentApi.applyConfig(chatId, config)
      .then((result) => {
        if (result.ok === false) {
          toast.error(result.message)
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : String(error))
      })
  }

  const handleModelChange = (nextKey: string) => {
    const next = visibleModels.find((model) => choiceKey(model) === nextKey)
    if (!next || !chatProperties) return
    const nextProps: ChatProperties = {
      ...chatProperties,
      model: next,
      reasoning: next.reasoningOptions[0],
      fast: false,
    }
    // One atomic update: new model, its first reasoning option, fast reset.
    // sessionMode is provider-level; this patch leaves it alone.
    updateChatProperties(chatId, { model: next, reasoning: next.reasoningOptions[0], fast: false })
    pushLiveConfig(nextProps)
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
      if (!props) {
        toast.error('Select a model before sending')
        return
      }
      let config: TurnConfig
      try {
        const built = turnConfigFromProperties(props)
        if (!built) {
          toast.error('Select a model before sending')
          return
        }
        config = built
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
        return
      }
      if (currentChat && currentChat.id === -1) {
        const loadedSettings = settings ?? await window.settingsApi.getSettings()
        const command = getProviderCliCommand(config.provider, loadedSettings)
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

      let chat = currentChat
      if (chat && chat.id === -1) {
        const newChat = await createChat(chat.connectionId)
        if (!newChat) return
        // Swap the -1 placeholder for the persisted chat: drop the placeholder,
        // select the real one, and keep using it for the rest of this send.
        removeChat(newChat.connectionId, -1)
        deleteChatProperties(-1)
        // Dropping the snapshot would snap a Plan pick back to Agent on the next send.
        setChatProperties(newChat.id, props)
        openChat(newChat.id)
        const initialTitle = deriveInitialChatTitle(text)
        await window.chatsApi.renameChat(newChat.id, initialTitle)
        renameChat(newChat.connectionId, newChat.id, initialTitle)
        chat = { ...newChat, name: initialTitle }
      }
      if (!chat) return

      setIsSending(true)
      setInput('')
      pushUserMessage(chat.id, text)
      try {
        if (!chat.provider){
          setProvider(chat.connectionId, chat.id, config.provider)
        }
        const promptText = `dangerousQueries: ${props.dangerousQueries ?? false}\nconnectionId: ${backendConnectionId ?? 'unknown'}\n${text}`
        const sent = await window.agentApi.sendTurn(chat.id, chat.sessionId ?? '', config, promptText, text)
        if (sent.sessionId && !chat.sessionId) {
          setSessionId(chat.connectionId, chat.id, sent.sessionId)
        }
        if (sent.ok === false) {
          toast.error(sent.message)
        }
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

  const createChat = async (connectionId: number): Promise<ChatModel | null> => {
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

  const handleAgentConnect = (chat: ChatModel) => {
    if (chat.provider !== 'cursor' && chat.provider !== 'opencode') {
      return
    }
    return window.agentApi.connect(chat.id, chat.sessionId ?? '')
      .then((connected) => {
        if (connected.provider) {
          setProvider(chat.connectionId, chat.id, connected.provider)
        }
        if (connected.sessionId) {
          setSessionId(chat.connectionId, chat.id, connected.sessionId)
        }
        if (connected.ok === false) {
          toast.error(connected.message)
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
        {permissionRequest ? (
          <div className="mb-3 flex flex-col items-start gap-2">
            <p className="text-sm" role="status">
              {permissionRequest.toolCall.title || 'Permission required'}
            </p>
            <div className="flex flex-wrap gap-2">
              {permissionRequest.options.map((option) => (
                <Button
                  key={option.optionId}
                  size="sm"
                  variant={option.kind === 'reject_once' || option.kind === 'reject_always' ? 'outline' : 'default'}
                  onClick={() => {
                    void window.agentApi.selectPermission(chatId, option.optionId)
                  }}
                >
                  {option.name}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void window.agentApi.dismissPermission(chatId)
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
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
              onValueChange={(value) => {
                const model = chatProperties?.model
                if (!model || !chatProperties) return
                const option = model.reasoningOptions.find((item) => item === value)
                if (!option) return
                updateChatProperties(chatId, { reasoning: option })
                pushLiveConfig({ ...chatProperties, reasoning: option })
              }}
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
            {chatProperties?.model?.provider === 'opencode' ? null : (
              <Select
                value={chatProperties?.sessionMode}
                onValueChange={(value) => {
                  if (!chatProperties) return
                  const sessionMode = parseSessionMode(value)
                  updateChatProperties(chatId, { sessionMode })
                  pushLiveConfig({ ...chatProperties, sessionMode })
                }}
                disabled={!chatProperties?.model || chatProperties.model.provider !== 'cursor'}
              >
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {chatProperties?.model?.hasFast ? (
              <div className="flex items-center gap-2">
                <Switch id="model-fast" checked={chatProperties?.fast ?? false} onCheckedChange={(checked) => {
                  if (!chatProperties) return
                  updateChatProperties(chatId, { fast: checked })
                  pushLiveConfig({ ...chatProperties, fast: checked })
                }} />
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
