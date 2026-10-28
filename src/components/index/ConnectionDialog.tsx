import { useForm } from '@tanstack/react-form'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import { useEffect } from 'react'
import { z } from 'zod'
import type Connection from '@/interfaces/Connection'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

interface ConnectionDialogProps {
  open: boolean
  editedConnection: Connection | null
  onOpenChange: (open: boolean) => void
  onSubmit: (connection: Omit<Connection, 'id'>) => Promise<void>
  setConnectionPendingEdit: (connection: Connection | null) => void
}

export default function ConnectionDialog({
  open,
  editedConnection,
  onOpenChange,
  onSubmit,
  setConnectionPendingEdit,
}: ConnectionDialogProps) {
  const connectionForm = useForm({
    defaultValues: {
      name: '',
      DBMS: 'mssql',
      host: '',
      username: '',
      password: '',
      database: '',
      query_values: [{ key: '', value: '' }],
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

      await onSubmit({
        name: value.name,
        dbms: value.DBMS,
        host: value.host,
        username: value.username,
        password: value.password,
        database: value.database,
        sqlalchemy_query: sqlalchemyQuery,
      })
      onOpenChange(false)
    },
  })

  useEffect(() => {

    if (!open) {
      connectionForm.reset()
      setConnectionPendingEdit(null)
      return
    }

    if (!editedConnection) {
      connectionForm.reset()
      return
    }

    const getPassword = async () => {
      const password = await window.connectionsApi.getPassword(editedConnection.id)
      return password
    }
    
    getPassword().then((password) => {
      connectionForm.reset({
        name: editedConnection.name,
        DBMS: editedConnection.dbms,
        host: editedConnection.host,
        username: editedConnection.username,
        password: password,
        database: editedConnection.database,
        query_values: Object.entries(editedConnection.sqlalchemy_query ?? {}).map(
          ([key, value]) => ({ key, value }),
        ),
      })      
    })

  }, [open, editedConnection])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editedConnection ? "Edit" : "Create"} Connection</DialogTitle>
          <DialogDescription>{editedConnection ? "Edit an existing database connection." : "Create a new database connection to start querying."}</DialogDescription>
        </DialogHeader>
        <form
          className="flex max-h-[calc(85vh-5rem)] flex-col"
          id="create-connection-form"
          onSubmit={(event) => {
            event.preventDefault()
            connectionForm.handleSubmit()
          }}
        >
          <FieldGroup className="overflow-y-auto pr-1">
            <connectionForm.Field
              name="name"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Connection Name</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="My Database Connection"
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
            <connectionForm.Field
              name="DBMS"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>DBMS</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      defaultValue="mssql"
                    >
                      <SelectTrigger id="form-tanstack-select-dbms" aria-invalid={isInvalid}>
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
            <connectionForm.Field
              name="host"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Host</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="localhost"
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
            <connectionForm.Field
              name="username"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="db_user"
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
            <connectionForm.Field
              name="password"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="password"
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
            <connectionForm.Field
              name="database"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Database</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="my_database"
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                )
              }}
            />
            <connectionForm.Field name="query_values" mode="array">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

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
                          Add additional options for your database connection. You can add multiple
                          key-value pairs to customize your connection settings.
                        </FieldDescription>
                        <FieldGroup className="gap-4">
                          {field.state.value.map((_, index) => (
                            <Field orientation="horizontal" key={index}>
                              <FieldContent>
                                <div className="flex items-start gap-2">
                                  <connectionForm.Field
                                    name={`query_values[${index}].key`}
                                    children={(keyField) => {
                                      const isKeyInvalid =
                                        keyField.state.meta.isTouched && !keyField.state.meta.isValid

                                      return (
                                        <Input
                                          className="flex-1"
                                          id={`form-tanstack-array-query-key-${index}`}
                                          name={keyField.name}
                                          value={keyField.state.value}
                                          onBlur={keyField.handleBlur}
                                          onChange={(event) =>
                                            keyField.handleChange(event.target.value)
                                          }
                                          aria-invalid={isKeyInvalid}
                                          placeholder="TrustServerCertificate"
                                          type="text"
                                        />
                                      )
                                    }}
                                  />
                                  <connectionForm.Field
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
                                          onChange={(event) =>
                                            valueField.handleChange(event.target.value)
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
                            onClick={() => field.pushValue({ key: '', value: '' })}
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
            </connectionForm.Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="create-connection-form">
              {editedConnection ? "Edit" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
