import type { ChatProperties } from '@/interfaces/ChatProperties'
import {
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

function isReasoningOption(value: string): value is ReasoningOption {
  const options: readonly string[] = REASONING_OPTIONS
  return options.includes(value)
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

export function sameTurnConfig(applied: TurnConfig, next: TurnConfig): boolean {
  if (applied.provider !== next.provider) {
    return false
  }
  if (applied.provider === 'cursor' && next.provider === 'cursor') {
    return applied.modelId === next.modelId
      && applied.reasoning === next.reasoning
      && applied.fast === next.fast
      && applied.mode === next.mode
  }
  return applied.provider === 'opencode'
    && next.provider === 'opencode'
    && applied.modelId === next.modelId
    && applied.variant === next.variant
}

export function parseCliProvider(input: unknown): CliProvider {
  if (input === 'cursor' || input === 'opencode') {
    return input
  }
  throw new Error(`Unknown chat provider: ${String(input)}`)
}
