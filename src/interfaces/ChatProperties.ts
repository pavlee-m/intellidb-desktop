import Model, { ReasoningOption } from "@/interfaces/Model"

export interface ChatProperties {
    model?: Model
    reasoning?: ReasoningOption
    fast?: boolean
    dangerousQueries?: boolean
}