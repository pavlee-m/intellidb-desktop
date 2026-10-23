import type { Model, OpenCodeVariant, ReasoningOption } from "@/interfaces/Model"
import type { SessionMode } from "@/interfaces/SessionMode"

export interface ChatProperties {
    model?: Model
    reasoning?: ReasoningOption | OpenCodeVariant
    fast?: boolean
    dangerousQueries?: boolean
    sessionMode?: SessionMode
}