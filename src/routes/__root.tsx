import useBackendConnectionStore from '@/stores/backendConnectionStore'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import useSettingsStore from '@/stores/settingsStore'
import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'

function RootLayout()  {
  const setSettings = useSettingsStore((state) => state.setSettings);
  const setConnections = useBackendConnectionStore((state) => state.setConnections)

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
