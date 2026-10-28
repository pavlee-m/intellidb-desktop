import useBackendConnectionStore from '@/stores/backendConnectionStore'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import useSettingsStore from '@/stores/settingsStore'
import { useEffect, useRef } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import useModelsStore from '@/stores/modelsStore'
import { Model } from '@/interfaces/Model'

function RootLayout() {
  const settings = useSettingsStore((state) => state.settings)
  const setSettings = useSettingsStore((state) => state.setSettings);
  const setConnections = useBackendConnectionStore((state) => state.setConnections)
  const setAllModels = useModelsStore((state) => state.setModels)
  const loadGeneration = useRef(0)

  const loadModels = async () => {
    const loaded = settings ?? await window.settingsApi.getSettings()
    const previous = useModelsStore.getState().models
    const kept = (provider: Model['provider']) =>
      previous.filter((model) => model.provider === provider)
    let cursorModels = loaded.cursor_cli_integration_enabled ? kept('cursor') : []
    let opencodeModels = loaded.opencode_integration_enabled ? kept('opencode') : []
    const publish = () => {
      setAllModels([...cursorModels, ...opencodeModels])
    }
    // Drop a provider that was just turned off before either CLI returns.
    publish()

    const loadProvider = async (provider: Model['provider']) => {
      const enabled = provider === 'cursor'
        ? loaded.cursor_cli_integration_enabled
        : loaded.opencode_integration_enabled
      if (!enabled) {
        return
      }
      try {
        const models = await window.modelsApi.list(provider)
        if (provider === 'cursor') {
          cursorModels = models
        } else {
          opencodeModels = models
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
        if (provider === 'cursor') {
          cursorModels = kept('cursor')
        } else {
          opencodeModels = kept('opencode')
        }
      }
      publish()
    }

    await Promise.all([loadProvider('cursor'), loadProvider('opencode')])
  }

  useEffect(() => {
    void loadModels()
  }, [
    settings?.cursor_cli_integration_enabled,
    settings?.opencode_integration_enabled,
    settings?.cursor_cli_binary,
    settings?.opencode_binary,
  ])


  useEffect(() => {
    window.connectionsApi
      .getConnections()
      .then(setConnections)
      .catch(console.error)
    window.settingsApi.getSettings().then(setSettings).catch(console.error);
  }, [])

  return (<>
    <Outlet />
    <Toaster />
  </>)
}

export const Route = createRootRoute({ component: RootLayout })
