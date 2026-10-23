import { RequestError } from '@agentclientprotocol/sdk'

export class OpenCodeAuthError extends Error {
  readonly kind = 'auth_required'
  readonly providerId: string | undefined

  constructor(providerId?: string) {
    super(
      providerId
        ? `Authentication required for ${providerId}. Run opencode auth login in a terminal, then try again.`
        : 'Authentication required. Run opencode auth login in a terminal, then try again.',
    )
    this.name = 'OpenCodeAuthError'
    this.providerId = providerId
  }
}

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && typeof entryValue === 'string') {
      return entryValue
    }
  }
  return undefined
}

function providerIdFrom(data: unknown): string | undefined {
  const providerId = stringField(data, 'providerId')
  if (!providerId) {
    return undefined
  }
  return providerId
}

function cliTextHasAuth(error: unknown): boolean {
  const stdout = stringField(error, 'stdout') ?? ''
  const stderr = stringField(error, 'stderr') ?? ''
  const text = `${stdout}\n${stderr}`
  return text.includes('Authentication required') || text.includes('auth_required')
}

export function readOpenCodeAuth(error: unknown): OpenCodeAuthError | undefined {
  if (error instanceof OpenCodeAuthError) {
    return error
  }
  if (
    error instanceof RequestError
    && error.code === -32000
    && error.message.startsWith('Authentication required')
  ) {
    return new OpenCodeAuthError(providerIdFrom(error.data))
  }
  if (cliTextHasAuth(error)) {
    const data = error instanceof RequestError ? error.data : undefined
    return new OpenCodeAuthError(providerIdFrom(data))
  }
  return undefined
}
