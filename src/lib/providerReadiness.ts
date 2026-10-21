import { useEffect, useState } from 'react'
import type Settings from '@/interfaces/Settings'
import {
  getProviderCliCommand,
  PROVIDER_CLI,
  type CliCommandCheckResult,
  type CliProvider,
} from '@/lib/cliCommand'
import useSettingsStore from '@/stores/settingsStore'

const CLI_PROVIDERS = Object.keys(PROVIDER_CLI) as CliProvider[]

type ProviderReadiness =
  | { status: 'checking' }
  | { status: 'ready' }
  | { status: 'no-provider'; message: string }
  | { status: 'cli-unavailable'; message: string }

function isIntegrationEnabled(provider: CliProvider, settings: Settings): boolean {
  switch (provider) {
    case 'cursor':
      return settings.cursor_cli_integration_enabled
    case 'opencode':
      return settings.opencode_integration_enabled
    default: {
      const _exhaustive: never = provider
      return _exhaustive
    }
  }
}

export function resolveProviderReadiness(input: {
  lockedProvider: '' | CliProvider
  settings: Settings | null
  cliResults: Partial<Record<CliProvider, CliCommandCheckResult>>
}): ProviderReadiness {
  const { lockedProvider, settings, cliResults } = input
  if (settings === null) {
    return { status: 'checking' }
  }

  if (lockedProvider) {
    if (!isIntegrationEnabled(lockedProvider, settings)) {
      return {
        status: 'no-provider',
        message: `${PROVIDER_CLI[lockedProvider].label} is not enabled. Enable it in Settings → Integrations.`,
      }
    }
    const result = cliResults[lockedProvider]
    if (!result) {
      return { status: 'checking' }
    }
    if (result.ok === false) {
      return { status: 'cli-unavailable', message: result.message }
    }
    return { status: 'ready' }
  }

  const usable = CLI_PROVIDERS.filter((provider) => isIntegrationEnabled(provider, settings))
  if (usable.length === 0) {
    return {
      status: 'no-provider',
      message: 'No model provider is enabled. Enable one in Settings → Integrations.',
    }
  }

  if (usable.some((provider) => cliResults[provider]?.ok === true)) {
    return { status: 'ready' }
  }
  if (usable.some((provider) => cliResults[provider] === undefined)) {
    return { status: 'checking' }
  }
  for (const provider of usable) {
    const result = cliResults[provider]
    if (result && result.ok === false) {
      return { status: 'cli-unavailable', message: result.message }
    }
  }
  return { status: 'checking' }
}

function failedCheckResult(error: unknown): CliCommandCheckResult {
  return {
    ok: false,
    reason: 'inaccessible',
    message: error instanceof Error ? error.message : String(error),
  }
}

export function useProviderReadiness(lockedProvider: '' | CliProvider): ProviderReadiness {
  const settings = useSettingsStore((state) => state.settings)
  const [cliResults, setCliResults] = useState<Partial<Record<CliProvider, CliCommandCheckResult>>>({})

  useEffect(() => {
    let cancelled = false
    setCliResults({})
    if (!settings) {
      return
    }

    const providers: CliProvider[] = lockedProvider ? [lockedProvider] : CLI_PROVIDERS

    void Promise.all(providers.map(async (provider) => {
      try {
        const result = await window.settingsApi.checkCliCommand(
          getProviderCliCommand(provider, settings),
        )
        if (!cancelled) {
          setCliResults((current) => ({ ...current, [provider]: result }))
        }
      } catch (error) {
        if (!cancelled) {
          setCliResults((current) => ({ ...current, [provider]: failedCheckResult(error) }))
        }
      }
    }))

    return () => {
      cancelled = true
    }
  }, [settings, lockedProvider])

  return resolveProviderReadiness({ lockedProvider, settings, cliResults })
}
