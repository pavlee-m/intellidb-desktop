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

export type AcpModelId = string & { readonly __brand: 'AcpModelId' }

export default interface Model {
  readonly name: string
  readonly id: AcpModelId
  readonly reasoningOptions: readonly ReasoningOption[]
  readonly hasFast: boolean
}
