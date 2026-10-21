import Model from "./Model"

export default interface ModelsState {
  models: Model[]
  setModels: (models: Model[]) => void
}