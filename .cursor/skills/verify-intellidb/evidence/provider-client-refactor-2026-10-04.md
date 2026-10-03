# ProviderClient interface refactor — behavior unchanged — 2026-10-04

Change: added `src/interfaces/ProviderClient.ts` (contract: `connect`,
`getSessionId`, `sendMessage`, `dispose`); `CursorClient` now declares
`implements ProviderClient`; `src/lib/AgentHost.ts` types all client state
against `ProviderClient` and keeps `new CursorClient(...)` as the default
construction. The diff is type-level only (imports of interfaces and
`implements` erase at compile), so compiled `main.js` is identical.

## Proof (real UI, real HOME, fresh forge build)

`INTELLIDB_SCRATCH_HOME="$HOME" launch.sh` after deleting `.vite/build` so
forge rebuilt main from the current tree. (First launch hit the known cold
backend-boot race — "Failed to start backend"; immediate retry succeeded.)

Through the real UI on the user's connection "local SQL Server": expanded the
connection, clicked the plus (the WIP renderer creates the chat client-side
and auto-connects the agent — two `agent --model composer-2.5 acp` processes
spawned, matching two connect attempts), filled the textarea with
`Reply with exactly: ok`, clicked Send.

Observed (screenshot `provider-client-refactor-2026-10-04.png`):

- agent thought streamed: italic "Preparing to reply with exactly 'ok'."
- agent reply streamed: `ok`
- no error toast, no `Agent connect failed` in `/tmp/intellidb-verify.log`

This exercises `ensureAgent` → `startAgent` → `CursorClient.connect` (spawn,
initialize, session/new), `promptAgent` → `sendMessage`, and the full
notification path (`ACPClient.sessionUpdate` → `ACPClientHandlers` →
renderer), all typed against `ProviderClient`.

## Other checks

- `tsc --noEmit` (TypeScript 5.6.3 one-off; the pinned 4.5.5 cannot parse the
  repo's own tsconfig): only the pre-existing `src/main.tsx` strictNullChecks
  error from TanStack Router types.
- `eslint` on the three touched files: only pre-existing findings
  (unresolved `@/` alias in eslint config, `prefer-const`, the stray
  `onOtherUpdate:` label, one `any`). New file clean.
- Note: the app was launched while a user-started `electron-forge start`
  instance held port 8000; the user killed it before this run (asked first).

## Cleanup

Graceful quit via cleanup.sh; both spawned `agent` processes must be gone
afterwards (exercises `disposeAgent`/`disposeAllAgents` → `dispose()`).