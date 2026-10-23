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

declare const OpenCodeModelIdBrand: unique symbol
declare const OpenCodeVariantBrand: unique symbol

export type OpenCodeModelId = string & { readonly [OpenCodeModelIdBrand]: 'OpenCodeModelId' }

export type OpenCodeVariant = string & { readonly [OpenCodeVariantBrand]: 'OpenCodeVariant' }

export function isOpenCodeModelId(
  line: string,
  providerID: string,
  modelID: string,
): line is OpenCodeModelId {
  if (providerID.length === 0 || modelID.length === 0) {
    return false
  }
  if (/\s/.test(line)) {
    return false
  }
  return line === `${providerID}/${modelID}`
}

export function isOpenCodeVariant(key: string): key is OpenCodeVariant {
  return key.length > 0 && !/\s/.test(key)
}

export type CursorModel = {
  provider: 'cursor'
  readonly name: string
  readonly id: string
  readonly reasoningOptions: readonly ReasoningOption[]
  readonly hasFast: boolean
}

export type OpenCodeModel = {
  provider: 'opencode'
  readonly name: string
  readonly id: OpenCodeModelId
  readonly reasoningOptions: readonly OpenCodeVariant[]
  readonly hasFast: false
}

export type Model = CursorModel | OpenCodeModel
