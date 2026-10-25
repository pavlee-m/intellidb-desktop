import { CircleQuestionMark } from 'lucide-react'
import type ChatModel from '@/models/ChatModel'
import type { CliProvider } from '@/lib/cliCommand'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import cursorLogo from '@/assets/cursor.svg'
import opencodeLogo from '@/assets/opencode.svg'

const PROVIDER_ICONS: Record<CliProvider, { src: string; alt: string; className: string }> = {
  cursor: {
    src: cursorLogo,
    alt: 'Cursor provider',
    // Cursor's SVG fill is #edecec, so it vanishes on the light sidebar without a dark chip.
    className: 'rounded-sm bg-neutral-900 p-px',
  },
  opencode: { src: opencodeLogo, alt: 'OpenCode provider', className: '' },
}

function lookupProviderIcon(provider: string) {
  if (provider === 'cursor' || provider === 'opencode') {
    return PROVIDER_ICONS[provider]
  }
  return null
}

interface ChatItemProps {
  chat: ChatModel
  onSelect: (chat: ChatModel) => void
  onRename: (chat: ChatModel) => void
  onDelete: (chat: ChatModel) => void
}

export default function ChatItem({ chat, onSelect, onRename, onDelete }: ChatItemProps) {
  const icon = lookupProviderIcon(chat.provider)

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left hover:bg-muted"
            onClick={() => onSelect(chat)}
          >
            {icon ? (
              <img
                src={icon.src}
                alt={icon.alt}
                className={`h-4 w-4 shrink-0 ${icon.className}`}
              />
            ) : (
              <CircleQuestionMark
                aria-label="No provider selected"
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
            )}
            {chat.name}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem
              onSelect={(event) => {
                event.preventDefault()
                onRename(chat)
              }}
            >
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                onDelete(chat)
              }}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  )
}
