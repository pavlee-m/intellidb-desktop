# Stale session fallback and live streaming proof — 2026-10-03

Verified the fix for "Agent is not connected": a chat whose stored `SessionID`
is dead (placeholder UUID or session from a previous app run) now falls back to
a fresh agent session instead of failing, and the new session id is persisted
back to the Chat row.

## Root cause

`DBManager.addChat` inserted `randomUUID()` as `SessionID`. That id is never an
ACP session id, so `session/load` always failed with "Session not found"
(`Invalid params`, code -32602) and connect gave up. Real ACP session ids only
exist after `connect()`.

## Fix under test

- `DBManager.addChat` inserts `''` (the session is earned from the agent).
- `DBManager.updateChatSessionId` + `setAgentSessionPersister` wiring in main.ts.
- `agentHost.ensureAgent`: on connect failure, dispose the failed client and
  retry once with a fresh session; persist the final session id.
- `agentHost.disposeAgent` / `disposeAllAgents` on chat delete and app quit.
- `CursorClient.getSessionId()` getter.
- Preload `onActivity` returns an unsubscribe (React StrictMode double-mounted
  the subscription effect and every streamed chunk rendered twice, e.g. "okok").

## What was run (real HOME, real DB, real agent login)

- Reproduced the user's exact failure: `Agent connect failed for chat 6 ...
  Session "0fc44e5e-..." not found`, then the prompt toasted
  "Error invoking remote method 'agent:prompt': Error: Agent is not connected".
- Selected chat 6 via the real UI. Load failed, fallback created a fresh
  session, and the DB row updated `0fc44e5e...` → `7f5444d8...`.
- First send exposed a second bug: the retry assigned `entry.client` before the
  retry's connect resolved, so every prompt saw "Agent is not connected" while
  the agent was actually alive. Fixed by assigning on resolution.
- Rebuilt and re-ran end to end: selected chat 6, the dead session
  (`7f5444d8...`) again fell back to a fresh session (`7e677306...`, verified in
  the DB), sent "Reply with exactly: ok" through the real Send button, and the
  agent's thought and reply streamed into the log exactly once
  (screenshot: `chat-live-reply-2026-10-03.png`).

## Observed

- Stale-session fallback works and repairs the Chat row.
- Live ACP streaming renders single-pass after the unsubscribe fix.
- Teardown killed electron, vite, and the app's agent tree; no orphans.

Two transient launch failures occurred while `npm run start` rebuilt
`.vite/build` inside launch.sh's 120s forge timeout window; immediate retries
with the bundle already present succeeded.
