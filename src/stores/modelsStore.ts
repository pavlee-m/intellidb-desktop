import { create } from 'zustand'
import ModelsState from '@/interfaces/ModelsState'


// Lives outside the component tree so the model list survives navigation.
const useModelsStore = create<ModelsState>((set) => ({
  models: [],
  setModels: (models) => set({ models }),
}))

export default useModelsStore
