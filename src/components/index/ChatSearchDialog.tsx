import { useEffect, useRef, useState } from 'react'
import type ChatSearchHit from '@/interfaces/ChatSearchHit'
import ProviderIcon from '@/components/index/ProviderIcon'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface ChatSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (hit: ChatSearchHit) => Promise<boolean>
}

export default function ChatSearchDialog({
  open,
  onOpenChange,
  onSelect,
}: ChatSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ChatSearchHit[]>([])
  const [isPending, setIsPending] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!open) {
      return
    }

    const trimmed = query.trim()
    if (!trimmed) {
      requestIdRef.current += 1
      setHits([])
      setIsPending(false)
      return
    }

    setIsPending(true)
    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(() => {
      void window.chatsApi.searchChats(trimmed).then((nextHits) => {
        if (requestId !== requestIdRef.current) {
          return
        }
        setHits(nextHits)
        setIsPending(false)
      }).catch((error) => {
        if (requestId !== requestIdRef.current) {
          return
        }
        console.error(error)
        setHits([])
        setIsPending(false)
      })
    }, 200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [open, query])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestIdRef.current += 1
      setQuery('')
      setHits([])
      setIsPending(false)
    }
    onOpenChange(nextOpen)
  }

  const handleSelect = async (hit: ChatSearchHit) => {
    const ok = await onSelect(hit)
    if (ok) {
      handleOpenChange(false)
    }
  }

  const trimmedQuery = query.trim()
  let emptyMessage: string | null = null
  if (!trimmedQuery) {
    emptyMessage = 'Type to search messages.'
  } else if (!isPending && hits.length === 0) {
    emptyMessage = 'No chats found.'
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
      title="Search chats"
      description="Search chats by message content"
    >
      <CommandInput
        placeholder="Search messages..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {emptyMessage ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
        {hits.map((hit) => (
          <CommandItem
            key={hit.chat.id}
            value={String(hit.chat.id)}
            onSelect={() => {
              void handleSelect(hit)
            }}
          >
            <ProviderIcon provider={hit.chat.provider} className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{hit.chat.name}</div>
              <div className="truncate text-xs text-muted-foreground">{hit.snippet}</div>
            </div>
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
