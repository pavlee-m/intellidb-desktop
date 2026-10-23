export const SESSION_MODE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'plan', label: 'Plan' },
] as const

export type SessionMode = (typeof SESSION_MODE_OPTIONS)[number]['value']

export function parseSessionMode(value: unknown): SessionMode {
  const match = SESSION_MODE_OPTIONS.find((option) => option.value === value)
  if (!match) {
    throw new Error(`Invalid session mode: ${String(value)}`)
  }
  return match.value
}
