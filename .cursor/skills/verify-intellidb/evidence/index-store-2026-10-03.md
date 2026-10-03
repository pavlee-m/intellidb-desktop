# Index page view state survives navigation (useIndexStore)

Date: 2026-10-03. Change under test: new `src/stores/indexStore.ts` +
`src/interfaces/IndexState.ts`; `src/routes/index.tsx` reads `openChatId` /
`openByConnectionId` from the store instead of `useState`, so the open chat
and expanded connections survive `/` → `/settings/general` → `/`.

## What ran (all through the real UI)

1. `launch.sh` (scratch HOME, CDP :9222).
2. Created connection "Proof DB" via the Add-connection dialog (real form fill
   and submit; row confirmed in `Connection` table via `db-query.mjs`).
3. Created a chat via hover + `Add item to Proof DB` (real `Input.dispatchMouseEvent`
   mouseMoved — plus button is hit-test-invisible until row hover; one-off
   script `/tmp/intellidb-hover.mjs`, modeled on `drive.mjs`).
4. Clicked the "New chat" row → ChatView mounted (textarea, Dangerous queries
   switch, Send).
5. `useIndexStore.getState()` via vite module import from `eval`:
   `{"openChatId":1,"openByConnectionId":{"1":true}}`.
6. Clicked `a[href="/settings/general"]` → `location.pathname` = `/settings/general`.
7. Clicked `a[href="/"]` (Home link in the settings sidebar) → back on `/`.

## Observed result

- After the round trip: `chatViewStillOpen: true`, placeholder gone, chat row
  still listed (connection still expanded), store state unchanged
  (`openChatId: 1`, `openByConnectionId {1: true}`).
- Screenshots: `index-store-before-nav.png`, `index-store-after-nav.png`.
- Side effect on disk: `Chat` row ID 1 "New chat" on connection 1, `SessionID ''`
  (verified via `db-query.mjs`).

## Honest notes

- First proof attempt was invalidated mid-run: three vite `[vite] page reload`
  events (23:49–23:51) from concurrent live edits to `src/stores/chatActivityStore.ts`
  (the operator debugging in their IDE). A full page reload resets the
  in-memory zustand store — expected, by design; the fix targets route
  navigation, not reloads. Proof rerun after the edits settled.
- `agent:connect` fails in the main process with "Authentication required"
  (Cursor ACP not logged in under the scratch HOME) and falls back to creating
  a new agent, which also requires auth. Selection does not depend on it; the
  chat opens and stays open regardless.
- Delete of the open chat clears `openChatId` via `closeChat()` (code-reviewed,
  not driven this run).
