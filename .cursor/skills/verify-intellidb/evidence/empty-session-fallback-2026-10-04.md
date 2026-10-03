# Empty chat fails to load after restart ("session id does not exist") — 2026-10-04

Symptom: create a chat, open it, send nothing, quit the app, relaunch, click
the chat. The agent connect fails and any prompt errors with
`Error invoking remote method 'agent:prompt': Error: Agent is not ready`.
The app log shows `Agent connect failed for chat <id> RequestError: Invalid
params` with `code: -32602`.

## CLI-level mechanism (probe, re-runnable)

`acp-load-probe-2026-10-04.mjs` (run `node <script>` from the repo root; it
mints one empty session in the real store). Output:

```
A session/new ok: 39a3e946-3924-4148-a667-1a9fc8c2c2b0
B session/load of never-prompted session FAILED: -32602 Invalid params
C session/load of prompted session: OK
```

The Cursor agent CLI resolves `session/load` against the session's
`store.db`. A session created via `session/new` but never prompted has only
`meta.json` (measured: 252 of 283 dirs in `~/.cursor/acp-sessions/` lack
`store.db`), so loading it fails with -32602 forever.

## App-level repro (real HOME, real UI)

1. `INTELLIDB_SCRATCH_HOME="$HOME" launch.sh` (agent login lives in the real
   HOME, so the repro cannot use a scratch HOME).
2. Created a chat on "local SQL Server" via hover plus, clicked it once.
   `session/new` ran and the Chat row's SessionID was persisted
   (`ac3fa304…`); its session dir held only `meta.json`.
3. Graceful quit, relaunch, clicked the same chat.

Failing output, verbatim from `/tmp/intellidb-verify.log`:

```
Agent connect failed for chat 10 RequestError: Invalid params
    ...  code: -32602,
Agent connect failed for chat 10 RequestError: Invalid params
    ...  code: -32602,
```

Two lines because the fallback in `ensureAgent` retried `startAgent` with the
same stored id. The chat view still opened (`agent:connect` resolves `''`),
so the breakage surfaced on send: toast
`Error invoking remote method 'agent:prompt': Error: Agent is not ready`
(screenshot `repro-run2-error.png`).

## Root cause

- `session/load` of a never-prompted session id fails with -32602 (CLI
  behavior, measured).
- `ensureAgent`'s recovery retry passed `storedId` again instead of dropping
  it, so a stale or empty-history session id poisoned the chat for the whole
  app session.
- `startAgent`'s catch returned without disposing the failed `CursorClient`,
  leaking one spawned `agent` process per failed attempt (the two orphaned
  agents observed on 2026-10-03 came from this path).

## Fix (src/lib/AgentHost.ts, two edits)

- The retry calls `startAgent(chatId, undefined, onActivity)` so a failed
  load falls back to a fresh session; `persistSessionId` writes the new id.
- The catch calls `client.dispose()` so the spawned agent process is killed.

## Verified (same surface, run 3)

After rebuilding `.vite/build/main.js` via forge (`timeout 75 npm run start`,
then relaunch):

```
Agent connect failed for chat 10 RequestError: Invalid params
Failed to connect to existing agent, creating a new agent
```

Exactly one failure line, the retry succeeded, and the DB row updated
`ac3fa304…` → `5996f372…`. Sending "Reply with exactly: ok" through the real
Send button streamed the agent's thought and reply "ok" with no error toast
(screenshot `fix-verified-live-reply.png`). The repro chat was then deleted
through the UI; the Chat row is gone and the user's chat 6 is untouched.

## Notes

- Forge builds main into `.vite/build/main.js`. Running
  `npx vite build -c vite.main.config.mts` bare builds the RENDERER into
  `dist/` (the config has no `input`, so vite falls back to `index.html`);
  it is not a main-process gate. This overwrote tracked `dist/` files once
  and they were restored with `git checkout`.
- One transient `launch: renderer never mounted` failure right after the
  forge rebuild; immediate retry succeeded.
- After teardown, `cursor-agent worker-server` and its TS language server
  remained on the machine. They predate the app runs (same processes existed
  before launch) and belong to Cursor IDE infrastructure; left alone.