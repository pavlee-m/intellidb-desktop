import type Connection from '@/interfaces/Connection'

// Represents mcp connections
export default interface BackendConnection {
    backendConnectionId: string,
    connection: Connection
}