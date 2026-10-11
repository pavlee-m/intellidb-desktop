import Model from "./Model"

export const OPENCODE_STUB_MODELS: Model[] = [
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
