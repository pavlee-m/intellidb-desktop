import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronDownIcon, Database, Plus, Search, Settings, XIcon } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useEffect, useState } from 'react'
import type Connection from '@/interfaces/Connection'
import mssqlLogo from '@/assets/microsoft-sql-server.svg'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  DBMS: z.string().min(1, 'DBMS is required'),
  host: z.string().min(1, 'Host is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  database: z.string().min(1, 'Database is required'),
  query_values: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
})

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
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)
  const [connectionPendingDelete, setConnectionPendingDelete] = useState<Connection | null>(null)
  const [isDeletingConnection, setIsDeletingConnection] = useState(false)

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

  const createSettingsForm = useForm({
    defaultValues: {
      name: '',
      DBMS: 'mssql',
      host: '',
      username: '',
      password: '',
      database: '',
      query_values: [{ key: "", value: "" }],
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      const queryValues = value.query_values.filter(
        ({ key, value: queryValue }) => key.trim() !== '' && queryValue.trim() !== '',
      )

      const sqlalchemyQuery = Object.fromEntries(
        queryValues.map(({ key, value: queryValue }) => [key.trim(), queryValue.trim()]),
      )

      const updatedConnections = await window.connectionsApi.addConnection({
        name: value.name,
        dbms: value.DBMS,
        host: value.host,
        username: value.username,
        password: value.password,
        database: value.database,
        sqlalchemy_query: sqlalchemyQuery,
      })

      setConnections(updatedConnections)
      setCreateDialogOpen(false)
      createSettingsForm.reset()
    },
  })

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
              <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" aria-label="Add connection">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>New connection</DialogTitle>
                    <DialogDescription>Create a new database connection to start querying.</DialogDescription>
                  </DialogHeader>
                  <form
                    className="flex max-h-[calc(85vh-5rem)] flex-col"
                    id="create-settings-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      createSettingsForm.handleSubmit()
                    }}
                  >
                    <FieldGroup className="overflow-y-auto pr-1">
                      <createSettingsForm.Field
                        name="name"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Connection Name</FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="My Database Connection"
                                autoComplete="off"
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          )
                        }}
                      />
                      <createSettingsForm.Field
                        name="DBMS"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>DBMS</FieldLabel>
                              <Select name={field.name} value={field.state.value} onValueChange={field.handleChange} defaultValue="mssql">
                                <SelectTrigger id='form-tanstack-select-dbms' aria-invalid={isInvalid}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mssql">MS SQL Server</SelectItem>
                                  {/* <SelectItem value="mysql">MySQL</SelectItem> */}
                                  {/* <SelectItem value="postgresql">PostgreSQL</SelectItem> */}
                                </SelectContent>
                              </Select>
                            </Field>
                          )
                        }}
                      />
                      <createSettingsForm.Field
                        name="host"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Host</FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="localhost"
                                autoComplete="off"
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          )
                        }}
                      />
                      <createSettingsForm.Field
                        name="username"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="db_user"
                                autoComplete="off"
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          )
                        }}
                      />
                      <createSettingsForm.Field
                        name="password"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                type="password"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="••••••••"
                                autoComplete="off"
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          )
                        }}
                      />
                      <createSettingsForm.Field
                        name="database"
                        children={(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Database</FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="my_database"
                                autoComplete="off"
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          )
                        }}
                      />
                      <createSettingsForm.Field name="query_values" mode="array">
                        {(field) => {
                          const isInvalid =
                            field.state.meta.isTouched && !field.state.meta.isValid
                          return (
                            <Collapsible className="rounded-md data-[state=open]:bg-muted">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="group w-full">
                                  Query Values
                                  <ChevronDownIcon className="ml-auto group-data-[state=open]:rotate-180" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="flex flex-col items-start gap-2 p-2.5 pt-0 text-sm">
                                    <FieldSet className="gap-4">
                                    <FieldDescription>
                                      Add additional options for your database connection. You can add multiple key-value pairs to customize your connection settings.
                                    </FieldDescription>
                                    <FieldGroup className="gap-4">
                                      {field.state.value.map((_, index) => (
                                        <Field orientation="horizontal" key={index}>
                                          <FieldContent>
                                            <div className="flex items-start gap-2">
                                              <createSettingsForm.Field
                                                name={`query_values[${index}].key`}
                                                children={(keyField) => {
                                                  const isKeyInvalid =
                                                    keyField.state.meta.isTouched &&
                                                    !keyField.state.meta.isValid
                                                  return (
                                                    <Input
                                                      className="flex-1"
                                                      id={`form-tanstack-array-query-key-${index}`}
                                                      name={keyField.name}
                                                      value={keyField.state.value}
                                                      onBlur={keyField.handleBlur}
                                                      onChange={(e) =>
                                                        keyField.handleChange(e.target.value)
                                                      }
                                                      aria-invalid={isKeyInvalid}
                                                      placeholder="TrustServerCertificate"
                                                      type="text"
                                                    />
                                                  )
                                                }}
                                              />
                                              <createSettingsForm.Field
                                                name={`query_values[${index}].value`}
                                                children={(valueField) => {
                                                  const isValueInvalid =
                                                    valueField.state.meta.isTouched &&
                                                    !valueField.state.meta.isValid
                                                  return (
                                                    <Input
                                                      className="flex-1"
                                                      id={`form-tanstack-array-query-value-${index}`}
                                                      name={valueField.name}
                                                      value={valueField.state.value}
                                                      onBlur={valueField.handleBlur}
                                                      onChange={(e) =>
                                                        valueField.handleChange(e.target.value)
                                                      }
                                                      aria-invalid={isValueInvalid}
                                                      placeholder="true"
                                                      type="text"
                                                      autoComplete="off"
                                                    />
                                                  )
                                                }}
                                              />
                                              {field.state.value.length > 1 && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="mt-0.5"
                                                  onClick={() => field.removeValue(index)}
                                                  aria-label={`Remove query ${index + 1}`}
                                                >
                                                  <XIcon className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                          </FieldContent>
                                        </Field>
                                      ))}
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => field.pushValue({ key: "", value: "" })}
                                      >
                                        Add Query Value
                                      </Button>
                                    </FieldGroup>
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                  </FieldSet>
                              </CollapsibleContent>
                            </Collapsible>
                          )
                        }}
                      </createSettingsForm.Field>
                    </FieldGroup>
                    <DialogFooter className="mt-4">
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button type="submit" form="create-settings-form">Create</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
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
                            <ContextMenuItem>Edit</ContextMenuItem>
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

      <Dialog
        open={Boolean(connectionPendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingConnection) {
            setConnectionPendingDelete(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete connection</DialogTitle>
            <DialogDescription>
              {connectionPendingDelete
                ? `This will permanently delete "${connectionPendingDelete.name}".`
                : 'This will permanently delete this connection.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isDeletingConnection}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConnection}
              disabled={isDeletingConnection}
            >
              {isDeletingConnection ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
