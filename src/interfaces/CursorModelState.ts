import Model from "./Model"

export default interface CursorModelsState {
  models: Model[]
  setModels: (models: Model[]) => void
}