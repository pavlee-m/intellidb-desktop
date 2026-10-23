import {
  isOpenCodeModelId,
  isOpenCodeVariant,
  type OpenCodeModel,
  type OpenCodeModelId,
  type OpenCodeVariant,
} from '@/interfaces/Model'

function openCodeModelId(providerID: string, modelID: string): OpenCodeModelId {
  const line = `${providerID}/${modelID}`
  if (!isOpenCodeModelId(line, providerID, modelID)) {
    throw new Error(`Invalid OpenCode model id ${line}`)
  }
  return line
}

function openCodeVariant(key: string): OpenCodeVariant {
  if (!isOpenCodeVariant(key)) {
    throw new Error(`Invalid OpenCode variant ${key}`)
  }
  return key
}

export const OPENCODE_STUB_MODELS: OpenCodeModel[] = [
  {
    provider: 'opencode',
    id: openCodeModelId('opencode', 'opencode-big-stub'),
    name: 'OpenCode Big',
    reasoningOptions: ['low', 'medium', 'high'].map(openCodeVariant),
    hasFast: false,
  },
  {
    provider: 'opencode',
    id: openCodeModelId('opencode', 'opencode-small-stub'),
    name: 'OpenCode Small',
    reasoningOptions: ['low', 'high'].map(openCodeVariant),
    hasFast: false,
  },
]
