import type ChatModel from '@/models/ChatModel'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import ProviderIcon from '@/components/index/ProviderIcon'

interface ChatItemProps {
  chat: ChatModel
  onSelect: (chat: ChatModel) => void
  onRename: (chat: ChatModel) => void
  onDelete: (chat: ChatModel) => void
}

export default function ChatItem({ chat, onSelect, onRename, onDelete }: ChatItemProps) {
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left hover:bg-muted"
            onClick={() => onSelect(chat)}
          >
            <ProviderIcon provider={chat.provider} className="h-4 w-4 shrink-0" />
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
