import { createFileRoute } from '@tanstack/react-router'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import useSettingsStore from '@/stores/settingsStore'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/settings/general')({
  component: RouteComponent,
})

function RouteComponent() {
  const settings = useSettingsStore((state) => state.settings)
  const setSettings = useSettingsStore((state) => state.setSettings);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings?.theme === 'dark')
  }, [])

  const toggleTheme = () => {
    const currentTheme = settings?.theme ?? 'light'
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    window.settingsApi.updateSetting('theme', nextTheme).then(setSettings).catch(console.error)
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
    </div>
  )
}
