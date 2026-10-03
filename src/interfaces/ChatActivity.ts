export type ChatActivityKind = 'user' | 'agent_message' | 'agent_thought' | 'tool' | 'plan'

export default interface ChatActivity {
  key: string
  kind: ChatActivityKind
  text: string
  status?: 'pending' | 'in_progress' | 'completed' | 'failed'
}
