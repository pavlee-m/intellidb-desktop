import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronDownIcon, Plus, Search, Settings, XIcon } from 'lucide-react'
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
    }),)
})

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const handleSearchClick = () => {
    console.log('Search clicked')
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
    onSubmit: ({ value }) => {
      if (value.query_values.length === 1 && value.query_values[0].key === "" && value.query_values[0].value === "") {
        value.query_values = []
      }
      console.log('Form submitted with values:', value)
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
              <p className="text-sm font-medium">Projects</p>
              <Dialog>
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
          <SidebarContent />
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
    </>
  )
}
