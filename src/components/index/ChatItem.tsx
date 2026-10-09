import type Chat from '@/interfaces/Chat'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'

interface ChatItemProps {
  chat: Chat
  onSelect: (chat: Chat) => void
  onRename: (chat: Chat) => void
  onDelete: (chat: Chat) => void
}

export default function ChatItem({ chat, onSelect, onRename, onDelete }: ChatItemProps) {
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            className="w-full rounded-md px-2.5 py-1 text-left hover:bg-muted"
            onClick={() => onSelect(chat)}
          >
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