export const REASONING_OPTIONS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'extra-high',
  'max',
] as const

export type ReasoningOption = typeof REASONING_OPTIONS[number]
export default interface Model {
  provider: 'cursor' | 'opencode'
  readonly name: string
  readonly id: string
  readonly reasoningOptions: readonly ReasoningOption[]
  readonly hasFast: boolean
}
