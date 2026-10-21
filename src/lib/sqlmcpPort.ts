export const DEFAULT_SQLMCP_PORT = 8000
const MIN_SQLMCP_PORT = 1024
const MAX_SQLMCP_PORT = 65535

export function parseSqlmcpPort(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) {
    return undefined
  }
  const port = Number(trimmed)
  if (port < MIN_SQLMCP_PORT || port > MAX_SQLMCP_PORT) {
    return undefined
  }
  return port
}
