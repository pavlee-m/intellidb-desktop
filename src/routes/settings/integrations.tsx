import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import useSettingsStore from '@/stores/settingsStore';
import opencodeLogo from '@/assets/opencode.svg';

export const Route = createFileRoute('/settings/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const settings = useSettingsStore((state) => state.settings)
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [binaryPath, setBinaryPath] = useState(settings?.opencode_binary ? settings.opencode_binary : "opencode");

  useEffect(() => {
    void window.settingsApi.getSettings().then((settings) => {
      setBinaryPath(settings.opencode_binary)
    })
  }, [])

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked
    window.settingsApi.updateSetting('opencode_integration_enabled', nextValue ? 'true' : 'false').then(setSettings).catch(console.error);
  }

  const handleBinaryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBinaryPath(event.target.value)
  }

  const handleBinaryBlur = () => {
    const trimmedBinary = binaryPath.trim()
    const nextBinary = trimmedBinary.length > 0 ? trimmedBinary : 'opencode'
    setBinaryPath(nextBinary)
    window.settingsApi.updateSetting('opencode_binary', nextBinary).then(setSettings).catch(console.error);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-medium">Integrations</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Integration settings will appear here. Connect external services, manage API keys, and configure
          sync behavior.
        </p>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex">
              <img alt="Opencode logo" className="h-8 w-8 bg-white rounded-full p-1 mr-3 mb-2" src={opencodeLogo} />
              <h3 className="font-medium">Opencode</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Enable Opencode integration and choose which binary command IntelliDB uses.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input checked={settings?.opencode_integration_enabled ?? false}className="h-4 w-4" onChange={handleEnabledChange} type="checkbox" />
            Enable
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium" htmlFor="opencode-binary">
            Opencode binary
          </label>
          <Input
            disabled={!settings?.opencode_integration_enabled}
            id="opencode-binary"
            onBlur={handleBinaryBlur}
            onChange={handleBinaryChange}
            placeholder="opencode"
            spellCheck={false}
            value={binaryPath}
          />
          <p className="text-xs text-muted-foreground">
            Example: <code>opencode</code> or an absolute path like <code>/usr/local/bin/opencode</code>.
          </p>
        </div>
      </section>
    </div>
  )
}
