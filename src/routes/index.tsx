import { createFileRoute, Link } from '@tanstack/react-router'
import { Database, Plus, Search, Settings } from 'lucide-react'
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
import mssqlLogo from '@/assets/microsoft-sql-server.svg'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import DeleteConnectionDialog from '@/components/index/DeleteConnectionDialog'
import ConnectionDialog from '@/components/index/ConnectionDialog'

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
  const [connections, setConnections] = useState<Connection[]>([])
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false)
  const [connectionPendingDelete, setConnectionPendingDelete] = useState<Connection | null>(null)
  const [isDeletingConnection, setIsDeletingConnection] = useState(false)
  const [connectionPendingEdit, setConnectionPendingEdit] = useState<Connection | null>(null)

  const handleSearchClick = () => {
    console.log('Search clicked')
  }

  useEffect(() => {
    window.connectionsApi.getConnections().then(setConnections).catch(console.error)
  }, [])

  const handleDeleteConnection = async () => {
    if (!connectionPendingDelete) {
      return
    }

    setIsDeletingConnection(true)
    try {
      const updatedConnections = await window.connectionsApi.deleteConnection(connectionPendingDelete.id)
      setConnections(updatedConnections)
      setConnectionPendingDelete(null)
    } catch (error) {
      console.error(error)
    } finally {
      setIsDeletingConnection(false)
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
              {connections.map((connection) => {
                const logo = getDbmsLogo(connection.dbms)
                return (
                  <SidebarMenuItem key={connection.id}>
                    <ContextMenu>
                      <ContextMenuTrigger className="flex w-full max-w-xs justify-center rounded-xl border border-dashed text-sm">
                        <SidebarMenuButton className="justify-start gap-2" type="button">
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
                        </SidebarMenuButton>
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
        onConnectionsChange={setConnections}
        setConnectionPendingEdit={setConnectionPendingEdit}
      />
    </>
  )
}
