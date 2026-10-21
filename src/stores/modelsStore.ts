import { create } from 'zustand'
import ModelsState from '@/interfaces/ModelsState'


// Lives outside the component tree so the model list survives navigation
// (e.g. Settings round-trips) without re-paying the listCursor() IPC on
// every remount of ChatView. The list is still refreshed in the background.
const useModelsStore = create<ModelsState>((set) => ({
  models: [],
  setModels: (models) => set({ models }),
}))

export default useModelsStore
