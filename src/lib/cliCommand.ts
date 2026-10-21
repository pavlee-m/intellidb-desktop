import type Settings from '@/interfaces/Settings'
import { DEFAULT_CURSOR_CLI_COMMAND } from '@/lib/cursorCliCommand'

type CliCommandFailureReason =
  | 'empty'
  | 'invalid'
  | 'not-found'
  | 'not-a-file'
  | 'not-executable'
  | 'inaccessible'

export type CliCommandCheckResult =
  | { ok: true; resolvedPath: string }
  | { ok: false; reason: CliCommandFailureReason; message: string }

export type CliProvider = 'cursor' | 'opencode'

export const PROVIDER_CLI: Record<CliProvider, {
  settingKey: 'cursor_cli_binary' | 'opencode_binary'
  fallback: string
  label: string
}> = {
  cursor: {
    settingKey: 'cursor_cli_binary',
    fallback: DEFAULT_CURSOR_CLI_COMMAND,
    label: 'Cursor CLI',
  },
  opencode: {
    settingKey: 'opencode_binary',
    fallback: 'opencode',
    label: 'OpenCode CLI',
  },
}

function normalizeCliCommand(raw: string | null | undefined, fallback: string): string {
  const trimmed = raw?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : fallback
}

export function getProviderCliCommand(
  provider: CliProvider,
  settings: Pick<Settings, 'cursor_cli_binary' | 'opencode_binary'>,
): string {
  const mapping = PROVIDER_CLI[provider]
  return normalizeCliCommand(settings[mapping.settingKey], mapping.fallback)
}
