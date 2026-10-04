// Probe: chat-open spinner race in AgentHost.ensureAgent.
//
// Scenario A mimics React StrictMode's mount pattern in the dev build:
// ChatView's handleAgentConnect effect fires twice, so two concurrent
// `agent:connect` IPC calls hit ensureAgent for the same chatId.
// Scenario B is the control: a single connect, as happens when switching
// to another chat (no remount, one effect run).
//
// Run: bun .cursor/skills/verify-intellidb/evidence/wait-race-probe-2026-10-04.ts
// Uses the user's real config DB chat 11 ("hey", stored session with history).
import { ensureAgent, disposeAgent } from '../../../../src/lib/AgentHost'
import type ChatActivity from '../../../../src/interfaces/ChatActivity'

const CHAT_ID = 11
const STORED = 'faefd9aa-37d2-4fc5-9c06-0119af243c5d'

const t0 = Date.now()
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(2)}s`

function fwd(label: string) {
  return (entry: ChatActivity) =>
    console.log(`${ts()} [${label}] activity kind=${entry.kind} ${JSON.stringify((entry.text ?? '').slice(0, 60))}`)
}

console.log('=== A: two concurrent ensureAgent calls (StrictMode mount pattern) ===')
const a1 = ensureAgent(CHAT_ID, STORED, fwd('A1')).then(
  (id) => console.log(`${ts()} [A1] resolved sessionId='${id}'`),
  (e) => console.log(`${ts()} [A1] REJECTED ${e.message}`),
)
const a2 = ensureAgent(CHAT_ID, STORED, fwd('A2')).then(
  (id) => console.log(`${ts()} [A2] resolved sessionId='${id}'`),
  (e) => console.log(`${ts()} [A2] REJECTED ${e.message}`),
)
await Promise.all([a1, a2])
console.log(`${ts()} [A] both resolved`)

disposeAgent(CHAT_ID)
await new Promise((r) => setTimeout(r, 1000))

console.log('=== B: single ensureAgent call (chat-switch pattern, control) ===')
const b1 = ensureAgent(CHAT_ID, STORED, fwd('B1')).then(
  (id) => console.log(`${ts()} [B1] resolved sessionId='${id}'`),
  (e) => console.log(`${ts()} [B1] REJECTED ${e.message}`),
)
await b1
console.log(`${ts()} [B] resolved`)

disposeAgent(CHAT_ID)
await new Promise((r) => setTimeout(r, 500))
process.exit(0)