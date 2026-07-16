import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronDownIcon, Database, Plus, Search, Settings } from 'lucide-react'
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
import { useEffect, useState } from 'react'
import type Connection from '@/interfaces/Connection'
import useBackendConnectionStore from '@/stores/backendConnectionStore'
import mssqlLogo from '@/assets/microsoft-sql-server.svg'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import DeleteConnectionDialog from '@/components/index/DeleteConnectionDialog'
import ConnectionDialog from '@/components/index/ConnectionDialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

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
  const setConnections = useBackendConnectionStore((state) => state.setConnections)
  const addConnection = useBackendConnectionStore((state) => state.addConnection)
  const editConnection = useBackendConnectionStore((state) => state.editConnection)
  const deleteConnection = useBackendConnectionStore((state) => state.deleteConnection)
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false)
  const [connectionPendingDelete, setConnectionPendingDelete] = useState<Connection | null>(null)
  const [isDeletingConnection, setIsDeletingConnection] = useState(false)
  const [connectionPendingEdit, setConnectionPendingEdit] = useState<Connection | null>(null)

  const handleSearchClick = () => {
    console.log('Search clicked')
  }

  useEffect(() => {
    window.connectionsApi
      .getConnections()
      .then((loadedConnections) =>
        setConnections(
          loadedConnections.map((connection) => ({
            backendConnectionId: String(connection.id),
            connection,
          })),
        ),
      )
      .catch(console.error)
  }, [])

  const handleDeleteConnection = async () => {
    if (!connectionPendingDelete) {
      return
    }

    setIsDeletingConnection(true)
    try {
      await window.connectionsApi.deleteConnection(connectionPendingDelete.id)
      deleteConnection(String(connectionPendingDelete.id))
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
        backendConnectionId: String(newId),
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
      backendConnectionId: String(updatedConnection.id),
      connection: updatedConnection,
    })
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
              {connections.map(({ backendConnectionId, connection }) => {
                const logo = getDbmsLogo(connection.dbms)
                return (
                  <SidebarMenuItem key={backendConnectionId}>
                    <ContextMenu>
                      <ContextMenuTrigger className="flex w-full justify-center rounded-xl text-sm">
                        <Collapsible className=" w-full rounded-md data-[state=open]:bg-muted">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="group w-full">
                              {logo.src ? (
                              <img
                                src={logo.src}
                                alt={logo.alt}
                                className="h-4 w-4 shrink-0"
                              />
                            ) : (
                              <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
                            )}
                            <span className="truncate">{connection.name}</span>
                            <ChevronDownIcon className="ml-auto group-data-[state=open]:rotate-180" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="flex flex-col items-start gap-2 p-2.5 pt-0 text-sm">
                            <ul>
                              <li>
                                <a>
                                  {connection.name}
                                  </a>
                                </li>
                              <li>  
                                <a>
                                  {connection.name}
                                </a>
                              </li>
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuGroup>
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
          <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
            <p className="text-base text-muted-foreground">Home page content goes here.</p>
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
    </>
  )
}
