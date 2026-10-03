# Chat with a database

## Sub-features

- Create / rename / delete a chat thread on a connection — **Implemented** (2026-10-02, see `evidence/chats-2026-10-02.md`).
- Lazy-load a connection's chats on expand (and on create) — **Implemented**.
- Select a chat — **Implemented** (opens the chat view: activity log, input box, footer controls).
- Send a message, get an agent response via ACP — **Implemented** (2026-10-03, see `evidence/stale-session-fallback-2026-10-03.md`). The agent session lives in the main process (`src/agentHost.ts`), bridged over `agent:connect` / `agent:prompt` / `agent:activity` IPC; the renderer has no Node access.
- Selection and expansion survive route navigation — **Implemented** (2026-10-03, see `evidence/index-store-2026-10-03.md`). `useIndexStore` (`src/stores/indexStore.ts`) holds `openChatId` and `openByConnectionId`, so `/` → `/settings/general` → `/` remounts `Index` with the same chat open and the same connections expanded. A full page reload still resets it (in-memory store, by design).

## How to get to it (user POV)

On Home, hover a connection row and click the `+` ("Add item to …") button, or
right-click the connection and pick `New chat`. A chat named `New chat` is
created in the `Chat` table and appears under the connection (the connection
auto-expands). Clicking a chat shows its name in the main pane. Right-click a
chat for `Rename` (dialog with prefilled input) and `Delete` (immediate, no
confirm).

Chats load lazily: a connection's list is fetched the first time it expands
and after each create; the renderer keeps it in the `chatStore`
(`chatsByConnection`, keyed by connection id). After an app restart the list
refetches from SQLite on first expand.

## Driving it with CDP

1. Create a connection and connect it (see `connect-disconnect.md`; a live
   MSSQL is only needed for the connect step — chat CRUD works on a
   disconnected connection).
2. **Hover before clicking the plus button.** It is `invisible` until row
   hover; hidden elements skip hit testing, so a bare CDP click falls through
   to the row div. Send `Input.dispatchMouseEvent` `mouseMoved` on the row
   first.
3. Plus: `click '[aria-label="Add item to <connection>"]'` → a `New chat`
   button appears under the connection and the collapsible opens.
4. Context menu: right-click the row (`mousePressed`/`mouseReleased` with
   `button: 'right'` — `drive.mjs click` is left-only) → menu items `Connect`
   or `Disconnect`, `New chat`, `Delete`, `Edit`.
5. Select: click the chat button → the chat view mounts (textarea, "Dangerous queries" switch, stub dropdown, Send).
6. Rename: right-click the chat → `Rename` → dialog input prefilled → submit →
   list, main pane, and `SELECT Name FROM Chat` all show the new name.
7. Delete: right-click the chat → `Delete` → a confirm modal opens (title
   `Delete chat`, destructive Delete). Cancel keeps the row; Delete removes it
   from UI and DB.
8. Persistence: quit gracefully (`window.close()`), relaunch, expand the
   connection → both chats reappear from the DB.

Proof needs the UI action (screenshot), the visible DOM state, and the
`Chat` row via `scripts/db-query.mjs` against the scratch home.

## Gotchas

- Radix context menus need real right-button events and real clicks; `el.click()` opens nothing.
- `:has-text()` is not a valid querySelector; tag targets with a data attribute via `eval`, then click that.
- Creating always refetches the list, so rows inserted outside the UI show up on the next create.
- `SessionID` is `NOT NULL`; chat creation inserts `''` and the agent host persists the real ACP session id after connect (with a fresh-session fallback when a stored id is stale — see `evidence/stale-session-fallback-2026-10-03.md`).
- Deleting a connection does not cascade to its chats (SQLite foreign keys are off in `src/main.ts`); orphan rows stay in `Chat`.