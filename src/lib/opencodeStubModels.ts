export interface AvailableModel {
  provider: 'cursor' | 'opencode'
  id: string
  name: string
  reasoningOptions: readonly string[]
  hasFast: boolean
}

export const OPENCODE_STUB_MODELS: AvailableModel[] = [
  {
    provider: 'opencode',
    id: 'opencode-big-stub',
    name: 'OpenCode Big',
    reasoningOptions: ['low', 'medium', 'high'],
    hasFast: true,
  },
  {
    provider: 'opencode',
    id: 'opencode-small-stub',
    name: 'OpenCode Small',
    reasoningOptions: ['low', 'high'],
    hasFast: false,
  },
]
