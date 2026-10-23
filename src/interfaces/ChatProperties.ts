import Model, { ReasoningOption } from "@/interfaces/Model"
import type { SessionMode } from "@/interfaces/SessionMode"

export interface ChatProperties {
    model?: Model
    reasoning?: ReasoningOption
    fast?: boolean
    dangerousQueries?: boolean
    sessionMode?: SessionMode
}