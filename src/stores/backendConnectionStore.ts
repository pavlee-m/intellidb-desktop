import { create } from 'zustand'
import BackendConnectionState from '@/interfaces/BackendConnectionState'

const useBackendConnectionStore = create<BackendConnectionState>((set) => ({
  backendConnections: [],

  setConnections: (connections) => set({ backendConnections: connections }),

  addConnection: (connection) =>
    set((state) => ({
      backendConnections: [...state.backendConnections, connection],
    })),

  editConnection: (connection) =>
    set((state) => ({
      backendConnections: state.backendConnections.map((existingConnection) =>
        existingConnection.connection.id === connection.connection.id
          ? {
              ...existingConnection,
              backendConnectionId: connection.backendConnectionId,
              connection: connection.connection,
            }
          : existingConnection,
      ),
    })),

  setConnectionStatus: (connectionId, backendConnectionId) =>
    set((state) => ({
      backendConnections: state.backendConnections.map((existingConnection) =>
        existingConnection.connection.id === connectionId
          ? { ...existingConnection, backendConnectionId, isConnecting: false }
          : existingConnection,
      ),
    })),

  setConnectionConnecting: (connectionId, isConnecting) =>
    set((state) => ({
      backendConnections: state.backendConnections.map((existingConnection) =>
        existingConnection.connection.id === connectionId
          ? { ...existingConnection, isConnecting }
          : existingConnection,
      ),
    })),

  deleteConnection: (connectionId) =>
    set((state) => ({
      backendConnections: state.backendConnections.filter(
        (connection) => connection.connection.id !== connectionId,
      ),
    })),
}))

export default useBackendConnectionStore
