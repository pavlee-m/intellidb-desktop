import { z } from 'zod'
import type { ChatProperties } from '@/interfaces/ChatProperties'
import {
  isOpenCodeModelId,
  isOpenCodeVariant,
  REASONING_OPTIONS,
  type OpenCodeModelId,
  type OpenCodeVariant,
  type ReasoningOption,
} from '@/interfaces/Model'
import type { CliProvider } from '@/lib/cliCommand'
import type { SessionMode } from '@/interfaces/SessionMode'

export type TurnConfig =
  | {
      provider: 'cursor'
      modelId: string
      reasoning?: ReasoningOption
      fast: boolean
      mode: SessionMode
    }
  | {
      provider: 'opencode'
      modelId: OpenCodeModelId
      variant?: OpenCodeVariant
    }

const cursorTurnSchema = z.strictObject({
  provider: z.literal('cursor'),
  modelId: z.string(),
  reasoning: z.enum(REASONING_OPTIONS).optional(),
  fast: z.boolean(),
  mode: z.enum(['agent', 'plan']),
})

const opencodeTurnSchema = z.strictObject({
  provider: z.literal('opencode'),
  modelId: z.string(),
  variant: z.string().optional(),
})

const turnConfigSchema = z.discriminatedUnion('provider', [
  cursorTurnSchema,
  opencodeTurnSchema,
])

function isReasoningOption(value: string): value is ReasoningOption {
  const options: readonly string[] = REASONING_OPTIONS
  return options.includes(value)
}

function brandOpenCodeModelId(modelId: string): OpenCodeModelId {
  const slash = modelId.indexOf('/')
  const providerID = slash === -1 ? '' : modelId.slice(0, slash)
  const modelPart = slash === -1 ? '' : modelId.slice(slash + 1)
  if (!isOpenCodeModelId(modelId, providerID, modelPart)) {
    throw new Error(`Invalid OpenCode model id: ${modelId}`)
  }
  return modelId
}

export function turnConfigFromProperties(props: ChatProperties): TurnConfig | undefined {
  const model = props.model
  if (!model) {
    return undefined
  }
  if (model.provider === 'cursor') {
    const reasoning = typeof props.reasoning === 'string' && isReasoningOption(props.reasoning)
      ? props.reasoning
      : undefined
    return {
      provider: 'cursor',
      modelId: model.id,
      reasoning,
      fast: model.hasFast ? props.fast === true : false,
      mode: props.sessionMode ?? 'agent',
    }
  }
  if (model.reasoningOptions.length === 0) {
    return { provider: 'opencode', modelId: model.id }
  }
  const selected = props.reasoning
  const variant = typeof selected === 'string'
    ? model.reasoningOptions.find((option) => option === selected)
    : undefined
  if (!variant) {
    throw new Error(`Select a variant offered by ${model.id}`)
  }
  return { provider: 'opencode', modelId: model.id, variant }
}

export function parseTurnConfig(input: unknown): TurnConfig {
  const parsed = turnConfigSchema.safeParse(input)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid turn config: ${detail}`)
  }
  if (parsed.data.provider === 'cursor') {
    return {
      provider: 'cursor',
      modelId: parsed.data.modelId,
      reasoning: parsed.data.reasoning,
      fast: parsed.data.fast,
      mode: parsed.data.mode,
    }
  }
  const modelId = brandOpenCodeModelId(parsed.data.modelId)
  if (parsed.data.variant === undefined) {
    return { provider: 'opencode', modelId }
  }
  if (!isOpenCodeVariant(parsed.data.variant)) {
    throw new Error(`Invalid OpenCode variant: ${parsed.data.variant}`)
  }
  return {
    provider: 'opencode',
    modelId,
    variant: parsed.data.variant,
  }
}

export function parseCliProvider(input: unknown): CliProvider {
  if (input === 'cursor' || input === 'opencode') {
    return input
  }
  throw new Error(`Unknown chat provider: ${String(input)}`)
}
