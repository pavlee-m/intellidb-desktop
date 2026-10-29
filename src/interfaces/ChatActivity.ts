export type PlanStep = {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

type ChatActivity =
  | { key: string; kind: 'user'; text: string }
  | { key: string; kind: 'agent_message'; text: string }
  | { key: string; kind: 'agent_thought'; text: string }
  | {
      key: string
      kind: 'tool'
      text: string
      status?: 'pending' | 'in_progress' | 'completed' | 'failed'
    }
  | { key: 'plan'; kind: 'plan'; steps: PlanStep[] }

export default ChatActivity
