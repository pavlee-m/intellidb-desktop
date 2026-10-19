# Dangerous queries state move — baseline pin (2026-10-19)

Refactor: move `dangerousQueries` from chatStore (`Chat` field) to globalStore (per-chat record), matching `selectedModel` / `reasoning` / `fast`.

Environment: scratch HOME launch, no MSSQL server available (port 1433 closed), so the send / placeholder-swap path is not UI-drivable. Verified the reachable surface.

## Steps run

1. `launch.sh` failed twice ("Failed to start backend"); reproduced manually with vite + electron against the scratch home — app booted, backend responsive (`GET /connections` → `{"connections":[]}`).
2. Created connection `VerifyConn` (mssql, 127.0.0.1) through the Add-connection dialog; row present in scratch config DB (`SELECT ID, Name, DBMS, Host FROM Connection` → ID 1).
3. `Chat` table has **no** DangerousQueries column — the field is pure frontend state; the backend load path always hits the `?? false` default.
4. No live MSSQL → "New chat" is disabled (gated on backendConnectionId), so seeded `INSERT INTO Chat (ConnectionID, Name, Provider) VALUES (1, 'Baseline chat', '')` directly in the scratch config DB, then drove the real UI.
5. Opened chat via sidebar click. ChatView mounted (textarea, Model, Reasoning, Dangerous queries, Send).

## Baseline behavior observed (via CDP, `#dangerous-queries` is a Radix switch, state read as `aria-checked`)

- Default: `false`
- Click 1: `true`
- Click 2: `false`
- Click 3: `true` (screenshot: `/tmp/intellidb-verify-baseline-on.png`)

## Contract the move must hold

- P1: a chat loaded from the backend starts with the switch off
- P2: toggling updates only that chat's flag
- P3: a new placeholder chat starts off (no stale `-1` key leak)
- P4: send builds `dangerousQueries: <bool>` as the agent query's first line

## Post-refactor re-run (after full move, live vite renderer)

- P1 default `false`: **pass** (re-run twice, before and after removing the now-unused `Chat` import)
- P2 toggle `false→true→false`: **pass**, identical to baseline
- No vite error overlay after reload (renderer compiles clean)
- P3, P4: not UI-drivable without MSSQL; verified by code read only. P3 note: the swap now calls `removeDangerousQueries(-1)` plus `setDangerousQueries(newChat.id, carried)`, which preserves the placeholder-resets-to-off behavior the old field-on-Chat shape gave for free.
- tsc: repo typecheck is broken independently of this change (tsc 4.5.5 vs @types/node 24, pre-existing). eslint: only pre-existing `import/no-unresolved` alias noise; the one new unused-import warning was fixed.

## Commit

Left uncommitted. A concurrent in-flight refactor (`modeId`, `Model` move to `src/interfaces/`) has interleaved hunks in the same files; no standalone green commit is possible without absorbing that work.

