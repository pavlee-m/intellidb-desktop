import BackendConnection from "@/interfaces/BackendConnection"

export default interface BackendConnectionState {
  backendConnections: BackendConnection[]
  setConnections: (connections: BackendConnection[]) => void
  addConnection: (connection: BackendConnection) => void
  editConnection: (connection: BackendConnection) => void
  setConnectionStatus: (connectionId: number, backendConnectionId: string) => void
  setConnectionConnecting: (connectionId: number, isConnecting: boolean) => void
  deleteConnection: (connectionId: number) => void
}
