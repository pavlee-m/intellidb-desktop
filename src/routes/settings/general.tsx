import { createFileRoute } from '@tanstack/react-router'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import useSettingsStore from '@/stores/settingsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_SQLMCP_PORT, parseSqlmcpPort } from '@/lib/sqlmcpPort'

export const Route = createFileRoute('/settings/general')({
  component: RouteComponent,
})

function RouteComponent() {
  const settings = useSettingsStore((state) => state.settings)
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [portDraft, setPortDraft] = useState(String(settings?.sqlmcp_port ?? DEFAULT_SQLMCP_PORT))
  const [portError, setPortError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings?.theme === 'dark')
  }, [])

  useEffect(() => {
    void window.settingsApi.getSettings().then((loadedSettings) => {
      setSettings(loadedSettings)
      setPortDraft(String(loadedSettings.sqlmcp_port))
    })
  }, [setSettings])

  const toggleTheme = () => {
    const currentTheme = settings?.theme ?? 'light'
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    window.settingsApi.updateSetting('theme', nextTheme).then(setSettings).catch(console.error)
  }

  const savePort = () => {
    const parsed = parseSqlmcpPort(portDraft)
    if (parsed === undefined) {
      setPortError('Port must be an integer from 1024 through 65535.')
      return
    }
    setPortError(null)
    setPortDraft(String(parsed))
    window.settingsApi.updateSetting('sqlmcp_port', String(parsed)).then(setSettings).catch(console.error)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Theme</h2>
            <p className="text-sm text-muted-foreground">Current theme: {settings?.theme}</p>
          </div>
          <Button onClick={toggleTheme} variant="secondary">
            {settings?.theme === 'light' ? (
              <>
                <Moon className="mr-2 h-4 w-4" />
                Switch to Dark
              </>
            ) : (
              <>
                <Sun className="mr-2 h-4 w-4" />
                Switch to Light
              </>
            )}
          </Button>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-medium">Backend port</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Restart IntelliDB for this change to take effect.
        </p>
        <Input
          type="text"
          inputMode="numeric"
          value={portDraft}
          onChange={(event) => setPortDraft(event.target.value)}
          onBlur={savePort}
          aria-invalid={portError !== null}
          className="mt-4 w-32"
        />
        {portError && (
          <p className="mt-2 text-sm text-destructive">{portError}</p>
        )}
      </section>
    </div>
  )
}
