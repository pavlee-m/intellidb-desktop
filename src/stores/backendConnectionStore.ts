import { create } from 'zustand'
import type BackendConnection from '@/interfaces/BackendConnection'
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

  deleteConnection: (backendConnectionId) =>
    set((state) => ({
      backendConnections: state.backendConnections.filter(
        (connection) => connection.backendConnectionId !== backendConnectionId,
      ),
    })),
}))

export default useBackendConnectionStore
