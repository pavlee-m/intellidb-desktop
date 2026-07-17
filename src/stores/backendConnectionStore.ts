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
        existingConnection.backendConnectionId === connection.backendConnectionId
          ? connection
          : existingConnection,
      ),
    })),

  setConnectionStatus: (connectionId, backendConnectionId) =>
    set((state) => ({
      backendConnections: state.backendConnections.map((existingConnection) =>
        existingConnection.connection.id === connectionId
          ? { ...existingConnection, backendConnectionId }
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
