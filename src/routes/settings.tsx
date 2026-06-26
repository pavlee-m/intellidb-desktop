import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light'
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)

  useEffect(() => {
    void window.settingsApi.getSettings().then((settings) => {
      setTheme(settings.theme)
      document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    })
  }, [])

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', nextTheme === 'dark')
      window.settingsApi.updateSetting('theme', nextTheme)
      return nextTheme
    })
  }

  return (
    <main className="min-h-svh bg-background p-6 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
          <h1 className="text-lg font-semibold">Settings</h1>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </header>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Theme</h2>
              <p className="text-sm text-muted-foreground">Current theme: {theme}</p>
            </div>
            <Button onClick={toggleTheme} variant="secondary">
              {theme === 'light' ? (
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
    </main>
  )
}
