# Offline connection blocks agent connect — 2026-10-04

Follow-up to offline-chat-gating: opening an offline chat must not spawn an
agent process. Main's `agent:connect` handler resolves the chat via
`DBManager.getChat` and throws `Connect the database before using the agent`
when its connection's `backendConnectionId` is empty. Chats without a DB row
(the renderer's `-1` placeholder) pass through. ChatView skips the call when
offline and depends on the online flag, so connecting the database
auto-connects the open chat's agent.

## Run (real UI, real HOME, fresh forge build)

- Baseline: 0 agent processes; app log had 0 agent spawn signatures.
- Opened existing chat "hey" offline through the real UI: Send stays
  disabled, no toast, 0 agent processes after 8s, 0 `OpenSSL certificates`
  spawn signatures in the app log (the CLI always prints that on spawn).
- Renderer probe `window.agentApi.connect(11, '')` threw
  `Connect the database before using the agent`.
- Clicked Connect (real MSSQL on localhost:1433, user's `sql2025` container):
  status flipped to Connected and the agent auto-connected — one spawn, then
  `Agent connect failed for chat 11 RequestError: Internal error (-32603
  invalid_union)` on session/load, and the fresh-session fallback failed the
  same way.

## The -32603 is NOT this feature's regression

While this run was in flight, parallel edits to the same working tree wired
MCP servers into `CursorClient` (new `mcpServers` constructor param plumbed
into both session/load and session/new, fed by `setAgentMcpServers` in main).
The verify build compiled that in-flight state. Evidence the failure is the
MCP wiring, not the gating:

- `acp-repro-probe-2026-10-04.mjs` (this dir) sends byte-identical request
  shapes with `mcpServers: []`: `session/load` of the same stored session
  (faefd9aa...) returns OK and `session/new` returns OK, minutes after the
  app failed.
- The app's failure is `invalid_union` — the CLI's schema rejects the
  in-flight `mcpServers` payload (`[{ type: 'http', name: 'sqlmcp', url:
  'http://127.0.0.1:8000/mcp', headers: [] }]` as it stood mid-edit).

Also unrelated and observed during the same run: a `vite page reload
src/main.ts` mid-run (the parallel edit landed while the app was up) left the
renderer without the preload bridge, which surfaced as TanStack Router's
error boundary (`Cannot read properties of undefined (reading
'getConnections')`).

## Cleanup

Verify instance torn down; 0 agent processes; ports 8000/5173/9222 free. A
separate user-launched electron (no debug port) was detected and left
running. Both test chats from earlier runs were already deleted; chat 11
"hey" untouched.

## Checks

- `tsc --noEmit` (TypeScript 5.6.3 one-off): only the pre-existing
  `src/main.tsx` strictNullChecks error.
- eslint on the two touched files: only pre-existing findings.