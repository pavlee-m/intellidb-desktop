import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import { CURSOR_CLI_BINARY_KEY, DEFAULT_CURSOR_CLI_COMMAND } from '@/lib/cursorCliCommand'
import useSettingsStore from '@/stores/settingsStore';
import opencodeLogo from '@/assets/opencode.svg';
import cursorLogo from '@/assets/cursor.svg';

export const Route = createFileRoute('/settings/integrations')({
  component: IntegrationsPage,
})

const CLI_CHECK_DEBOUNCE_MS = 400

function useCliCommandValidation(rawValue: string, enabled: boolean): string | null {
  const [error, setError] = useState<string | null>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    const trimmed = rawValue.trim()
    // Bump in the effect body so an edit-to-effect stale window cannot apply.
    const seq = ++seqRef.current

    if (!enabled || trimmed.length === 0) {
      setError(null)
      return
    }

    const timer = window.setTimeout(() => {
      void window.settingsApi.checkCliCommand(trimmed)
        .then((result) => {
          if (seqRef.current !== seq) {
            return
          }
          setError(result.ok === false ? result.message : null)
        })
        .catch((reason) => {
          if (seqRef.current !== seq) {
            return
          }
          const detail = reason instanceof Error ? reason.message : String(reason)
          setError(`Unable to validate command: ${detail}`)
        })
    }, CLI_CHECK_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [rawValue, enabled])

  return error
}

function IntegrationsPage() {
  const settings = useSettingsStore((state) => state.settings)
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [opencodeBinaryPath, setOpencodeBinaryPath] = useState(
    settings?.opencode_binary ? settings.opencode_binary : 'opencode',
  );
  const [cursorCliBinaryPath, setCursorCliBinaryPath] = useState(
    settings?.cursor_cli_binary ? settings.cursor_cli_binary : DEFAULT_CURSOR_CLI_COMMAND,
  );

  useEffect(() => {
    void window.settingsApi.getSettings().then((loadedSettings) => {
      setOpencodeBinaryPath(loadedSettings.opencode_binary)
      setCursorCliBinaryPath(loadedSettings.cursor_cli_binary)
    })
  }, [])

  const opencodeEnabled = Boolean(settings?.opencode_integration_enabled)
  const cursorCliEnabled = Boolean(settings?.cursor_cli_integration_enabled)
  const opencodeError = useCliCommandValidation(opencodeBinaryPath, opencodeEnabled)
  const cursorCliError = useCliCommandValidation(cursorCliBinaryPath, cursorCliEnabled)

  const handleOpencodeEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked
    window.settingsApi.updateSetting('opencode_integration_enabled', nextValue ? 'true' : 'false').then(setSettings).catch(console.error);
  }

  const handleOpencodeBinaryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setOpencodeBinaryPath(event.target.value)
  }

  const handleOpencodeBinaryBlur = () => {
    const trimmedBinary = opencodeBinaryPath.trim()
    const nextBinary = trimmedBinary.length > 0 ? trimmedBinary : 'opencode'
    setOpencodeBinaryPath(nextBinary)
    window.settingsApi.updateSetting('opencode_binary', nextBinary).then(setSettings).catch(console.error);
  }

  const handleCursorCliEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked
    window.settingsApi.updateSetting('cursor_cli_integration_enabled', nextValue ? 'true' : 'false').then(setSettings).catch(console.error);
  }

  const handleCursorCliBinaryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCursorCliBinaryPath(event.target.value)
  }

  const handleCursorCliBinaryBlur = () => {
    const trimmedBinary = cursorCliBinaryPath.trim()
    const nextBinary = trimmedBinary.length > 0 ? trimmedBinary : DEFAULT_CURSOR_CLI_COMMAND
    setCursorCliBinaryPath(nextBinary)
    window.settingsApi.updateSetting(CURSOR_CLI_BINARY_KEY, nextBinary).then(setSettings).catch(console.error);
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
            <input
              checked={settings?.opencode_integration_enabled ?? false}
              className="h-4 w-4"
              onChange={handleOpencodeEnabledChange}
              type="checkbox"
            />
            Enable
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium" htmlFor="opencode-binary">
            Opencode binary
          </label>
          <Input
            aria-describedby={
              opencodeError
                ? 'opencode-binary-hint opencode-binary-error'
                : 'opencode-binary-hint'
            }
            aria-invalid={Boolean(opencodeError)}
            disabled={!settings?.opencode_integration_enabled}
            id="opencode-binary"
            onBlur={handleOpencodeBinaryBlur}
            onChange={handleOpencodeBinaryChange}
            placeholder="opencode"
            spellCheck={false}
            value={opencodeBinaryPath}
          />
          <p className="text-xs text-muted-foreground" id="opencode-binary-hint">
            Example: <code>opencode</code> or an absolute path like <code>/usr/local/bin/opencode</code>.
          </p>
          {opencodeError ? (
            <p className="mt-2 text-sm text-destructive" id="opencode-binary-error" role="alert">
              {opencodeError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex">
              <img alt="Cursor logo" className="h-8 w-8 bg-neutral-900 rounded-full p-1 mr-3 mb-2" src={cursorLogo} />
              <h3 className="font-medium">Cursor CLI</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Enable Cursor CLI integration and choose which binary command IntelliDB uses.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={settings?.cursor_cli_integration_enabled ?? false}
              className="h-4 w-4"
              onChange={handleCursorCliEnabledChange}
              type="checkbox"
            />
            Enable
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium" htmlFor="cursor-cli-binary">
            Cursor CLI binary
          </label>
          <Input
            aria-describedby={
              cursorCliError
                ? 'cursor-cli-binary-hint cursor-cli-binary-error'
                : 'cursor-cli-binary-hint'
            }
            aria-invalid={Boolean(cursorCliError)}
            disabled={!settings?.cursor_cli_integration_enabled}
            id="cursor-cli-binary"
            onBlur={handleCursorCliBinaryBlur}
            onChange={handleCursorCliBinaryChange}
            placeholder={DEFAULT_CURSOR_CLI_COMMAND}
            spellCheck={false}
            value={cursorCliBinaryPath}
          />
          <p className="text-xs text-muted-foreground" id="cursor-cli-binary-hint">
            Example: <code>cursor-agent</code>, <code>agent</code>, or an absolute path like{' '}
            <code>/usr/local/bin/cursor-agent</code>.
          </p>
          {cursorCliError ? (
            <p className="mt-2 text-sm text-destructive" id="cursor-cli-binary-error" role="alert">
              {cursorCliError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
