import BackendConnection from "@/interfaces/BackendConnection"

export default interface BackendConnectionState {
  backendConnections: BackendConnection[]
  setConnections: (connections: BackendConnection[]) => void
  addConnection: (connection: BackendConnection) => void
  editConnection: (connection: BackendConnection) => void
  deleteConnection: (backendConnectionId: string) => void
}