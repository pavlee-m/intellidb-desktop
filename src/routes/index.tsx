import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronDownIcon, CirclePlus, Database, Plus, Search, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '../components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import type Chat from '@/interfaces/Chat'
import type Connection from '@/interfaces/Connection'
import useBackendConnectionStore from '@/stores/backendConnectionStore'
import useChatStore from '@/stores/chatStore'
import useIndexStore from '@/stores/indexStore'
import mssqlLogo from '@/assets/microsoft-sql-server.svg'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import DeleteConnectionDialog from '@/components/index/DeleteConnectionDialog'
import DeleteChatDialog from '@/components/index/DeleteChatDialog'
import ConnectionDialog from '@/components/index/ConnectionDialog'
import ChatItem from '@/components/index/ChatItem'
import RenameChatDialog from '@/components/index/RenameChatDialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import useChatActivityStore from '@/stores/chatActivityStore'
import ChatView from '@/components/index/ChatView'

function getDbmsLogo(dbms: string): { src?: string; alt: string } {
  const normalizedDbms = dbms.trim().toLowerCase()

  if (normalizedDbms === 'mssql' || normalizedDbms === 'sqlserver' || normalizedDbms === 'sql server') {
    return { src: mssqlLogo, alt: 'MS SQL Server' }
  }

  return { alt: dbms }
}

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const connections = useBackendConnectionStore((state) => state.backendConnections)
  const addConnection = useBackendConnectionStore((state) => state.addConnection)
  const editConnection = useBackendConnectionStore((state) => state.editConnection)
  const setConnectionStatus = useBackendConnectionStore((state) => state.setConnectionStatus)
  const setConnectionConnecting = useBackendConnectionStore((state) => state.setConnectionConnecting)
  const deleteConnection = useBackendConnectionStore((state) => state.deleteConnection)
  const chatsByConnection = useChatStore((state) => state.chatsByConnection)
  const setChats = useChatStore((state) => state.setChats)
  const addChat = useChatStore((state) => state.addChat)
  const renameChat = useChatStore((state) => state.renameChat)
  const removeChat = useChatStore((state) => state.removeChat)
  const setSessionId = useChatStore((state) => state.setSessionId)
  const openChatId = useIndexStore((state) => state.openChatId)
  const openChat = useIndexStore((state) => state.openChat)
  const closeChat = useIndexStore((state) => state.closeChat)
  const openByConnectionId = useIndexStore((state) => state.openByConnectionId)
  const setConnectionOpen = useIndexStore((state) => state.setConnectionOpen)
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false)
  const [connectionPendingDelete, setConnectionPendingDelete] = useState<Connection | null>(null)
  const [isDeletingConnection, setIsDeletingConnection] = useState(false)
  const [connectionPendingEdit, setConnectionPendingEdit] = useState<Connection | null>(null)
  const [chatPendingRename, setChatPendingRename] = useState<Chat | null>(null)
  const [chatPendingDelete, setChatPendingDelete] = useState<Chat | null>(null)
  const [isDeletingChat, setIsDeletingChat] = useState(false)
  const [loadingChatIds, setLoadingChatIds] = useState<Set<number>>(new Set())
  const applyAgentUpdate = useChatActivityStore((state) => state.applyAgentUpdate)

  useEffect(() => window.agentApi.onActivity((chatId, entry) => applyAgentUpdate(chatId, entry)), [])

  // Selected chat is derived from the store, so store updates (rename, delete)
  // propagate automatically without duplicating the object in local state.
  const selectedChat = useMemo(() => {
    if (openChatId === null) {
      return null
    }
    for (const chats of Object.values(chatsByConnection)) {
      const match = chats.find((chat) => chat.id === openChatId)
      if (match) {
        return match
      }
    }
    return null
  }, [openChatId, chatsByConnection])

  const handleConnect = async (connection: Connection) => {
    setConnectionConnecting(connection.id, true)
    try {
      const backendConnectionId = await window.connectionsApi.connectConnection(connection.id)
      setConnectionStatus(connection.id, backendConnectionId)
      toast.success(`Connected to ${connection.name}`)
    } catch (error) {
      console.error(error)
      setConnectionConnecting(connection.id, false)
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDisconnect = async (connection: Connection) => {
    try {
      await window.connectionsApi.disconnectConnection(connection.id)
      setConnectionStatus(connection.id, '')
      toast.success(`Disconnected from ${connection.name}`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleConnectionOpenChange = async (connectionId: number, open: boolean) => {
    setConnectionOpen(connectionId, open)
    if (!open || connectionId in chatsByConnection) {
      return
    }

    try {
      // If the connection's chats are already loaded, don't fetch them again.
      if (chatsByConnection[connectionId]) {
        return
      }
      const chats = await window.chatsApi.getChats(connectionId)
      setChats(connectionId, chats)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleCreateChat = async (connectionId: number) => {
    // Placeholders.
    addChat(connectionId, { id: -1, connectionId: connectionId, name: 'New chat', sessionId: '' } as Chat);
    openChat(-1)
  }

  const handleRenameChat = async (name: string) => {
    if (!chatPendingRename) {
      return
    }

    try {
      await window.chatsApi.renameChat(chatPendingRename.id, name)
      renameChat(chatPendingRename.connectionId, chatPendingRename.id, name)
      setChatPendingRename(null)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDeleteChatConfirm = async () => {
    if (!chatPendingDelete) {
      return
    }

    setIsDeletingChat(true)
    try {
      await window.chatsApi.deleteChat(chatPendingDelete.id)
      removeChat(chatPendingDelete.connectionId, chatPendingDelete.id)
      if (chatPendingDelete.id === useIndexStore.getState().openChatId) {
        closeChat()
      }
      setChatPendingDelete(null)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setIsDeletingChat(false)
    }
  }

  const handleSearchClick = () => {
    console.log('Search clicked')
  }

  const handleDeleteConnection = async () => {
    if (!connectionPendingDelete) {
      return
    }

    setIsDeletingConnection(true)
    try {
      await window.connectionsApi.deleteConnection(connectionPendingDelete.id)
      deleteConnection(connectionPendingDelete.id)
      setConnectionPendingDelete(null)
    } catch (error) {
      console.error(error)
    } finally {
      setIsDeletingConnection(false)
    }
  }

  const handleConnectionSubmit = async (connection: Omit<Connection, 'id'>) => {
    if (!connectionPendingEdit) {
      const newId = await window.connectionsApi.addConnection(connection)

      addConnection({
        backendConnectionId: '',
        connection: { ...connection, id: newId },
      })
      return
    }

    const updatedConnection: Connection = {
      ...connection,
      id: connectionPendingEdit.id,
    }
    await window.connectionsApi.editConnection(updatedConnection)
    editConnection({
      backendConnectionId: '',
      connection: updatedConnection,
    })
  }

  const handleChatSelect = (chat: Chat) => {
    console.log('handleChatSelect', chat.id)
    openChat(chat.id);
    if (chatsByConnection[chat.connectionId]?.find((chat) => chat.id === -1) && chat.id !== -1) {
      removeChat(chat.connectionId, -1);
    }
  }

  return (
    <>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader className="gap-3 border-b p-4">
            <Button
              className="w-full justify-start"
              onClick={handleSearchClick}
              type="button"
              variant="outline"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </Button>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Connections</p>
              <Button
                onClick={() => {
                  setConnectionPendingEdit(null)
                  setIsConnectionDialogOpen(true)
                }}
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Add connection"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {connections.map(({ backendConnectionId, connection, isConnecting }) => {
                const logo = getDbmsLogo(connection.dbms)
                const chats = chatsByConnection[connection.id]
                return (
                  <SidebarMenuItem key={backendConnectionId}>
                    <Collapsible
                      className="group w-full rounded-md data-[state=open]:bg-muted"
                      open={openByConnectionId[connection.id] ?? false}
                      onOpenChange={(open) => {
                        void handleConnectionOpenChange(connection.id, open)
                      }}
                    >
                      <ContextMenu>
                        <ContextMenuTrigger className="flex w-full justify-center rounded-xl text-sm">
                          <div className="group/connection flex w-full items-center">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="min-w-0 flex-1 justify-start">
                                <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                                {logo.src ? (
                                  <img
                                    src={logo.src}
                                    alt={logo.alt}
                                    className="h-4 w-4 shrink-0"
                                  />
                                ) : (
                                  <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
                                )}
                                <span
                                  aria-label={isConnecting ? 'Connecting' : backendConnectionId ? 'Connected' : 'Disconnected'}
                                  className={`h-2 w-2 shrink-0 rounded-full ${isConnecting ? 'animate-spin border-2 border-muted-foreground border-t-transparent bg-transparent' : backendConnectionId ? 'bg-green-500' : 'bg-red-500'}`}
                                />
                                <span className="truncate">{connection.name}</span>
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              className="ml-auto invisible scale-95 opacity-0 transition-all duration-200 group-hover/connection:visible group-hover/connection:scale-100 group-hover/connection:opacity-100"
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Add item to ${connection.name}`}
                              disabled={!backendConnectionId}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleCreateChat(connection.id)
                              }}
                            >
                              <CirclePlus className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuGroup>
                            <ContextMenuItem
                              disabled={isConnecting}
                              onSelect={() => {
                                void (backendConnectionId
                                  ? handleDisconnect(connection)
                                  : handleConnect(connection))
                              }}
                            >
                              {backendConnectionId ? 'Disconnect' : 'Connect'}
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={!backendConnectionId}
                              onSelect={() => {
                                void handleCreateChat(connection.id)
                              }}
                            >
                              New chat
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={(event) => {
                                event.preventDefault()
                                setConnectionPendingDelete(connection)
                              }}
                            >
                              Delete
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => {
                              setConnectionPendingEdit(connection)
                              setIsConnectionDialogOpen(true)
                            }}>Edit</ContextMenuItem>
                          </ContextMenuGroup>
                        </ContextMenuContent>
                      </ContextMenu>
                      <CollapsibleContent className="flex flex-col items-start gap-2 p-2.5 pt-0 text-sm">
                        <ul className="flex w-full flex-col gap-1">
                          {(chats ?? []).map((chat) => (
                            <ChatItem
                              key={chat.id}
                              chat={chat}
                              onSelect={() => handleChatSelect(chat)}
                              onRename={setChatPendingRename}
                              onDelete={setChatPendingDelete}
                            />
                          ))}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="mt-auto border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild variant="outline" size="lg" className="justify-start">
                  <Link to="/settings/general">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
            <div className="grid h-14 grid-cols-[auto_1fr_auto] items-center px-4">
              <SidebarTrigger />
              <h1 className="text-center text-sm font-semibold tracking-wide">Home</h1>
              <span className="h-9 w-9" aria-hidden="true" />
            </div>
          </header>
          <main className="flex min-h-0 flex-1 flex-col">
            {selectedChat ? (
              <ChatView chatId={selectedChat.id} />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <p className="text-base text-muted-foreground">Select an existing thread or create a new one.</p>
              </div>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <DeleteConnectionDialog
        connection={connectionPendingDelete}
        isDeleting={isDeletingConnection}
        onOpenChange={(open) => {
          if (!open && !isDeletingConnection) {
            setConnectionPendingDelete(null)
          }
        }}
        onConfirm={handleDeleteConnection}
      />
      <ConnectionDialog
        open={isConnectionDialogOpen}
        editedConnection={connectionPendingEdit}
        onOpenChange={setIsConnectionDialogOpen}
        onSubmit={handleConnectionSubmit}
        setConnectionPendingEdit={setConnectionPendingEdit}
      />
      <RenameChatDialog
        chat={chatPendingRename}
        onOpenChange={(open) => {
          if (!open) {
            setChatPendingRename(null)
          }
        }}
        onSubmit={handleRenameChat}
      />
      <DeleteChatDialog
        chat={chatPendingDelete}
        isDeleting={isDeletingChat}
        onOpenChange={(open) => {
          if (!open && !isDeletingChat) {
            setChatPendingDelete(null)
          }
        }}
        onConfirm={handleDeleteChatConfirm}
      />
    </>
  )
}
