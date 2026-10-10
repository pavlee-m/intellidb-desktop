export type CursorCliCommand = string & { readonly __brand: 'CursorCliCommand' }

export const DEFAULT_CURSOR_CLI_COMMAND = 'cursor-agent' as CursorCliCommand
export const CURSOR_CLI_BINARY_KEY = 'cursor_cli_binary'

export function parseCursorCliCommand(raw: string | null | undefined): CursorCliCommand {
  const trimmed = raw?.trim() ?? ''
  if (trimmed.length === 0) {
    return DEFAULT_CURSOR_CLI_COMMAND
  }
  return trimmed as CursorCliCommand
}
