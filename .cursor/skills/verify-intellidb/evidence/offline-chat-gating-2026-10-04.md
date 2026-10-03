# Offline connection blocks chat creation and sending — 2026-10-04

Feature: when a connection's `backendConnectionId` is empty, the user cannot
create new chats and cannot send messages in existing ones. Main process
guards the `chats:add` and `agent:prompt` IPC handlers; the renderer disables
the plus button, the New chat menu item, and the Send button from the same
field. Implementation delegated to a subagent, reviewed before the run.

## Run (real UI, real HOME, fresh forge build, live MSSQL)

Launched with `INTELLIDB_SCRATCH_HOME="$HOME" launch.sh`. The `sql2025`
docker container (user's own, stopped 23h) was started first so the online
path could be exercised against a real server.

Offline (initial state):

- Status dot "Disconnected". Plus button `disabled: true` (DOM assert).
- Context menu: `New chat` disabled, `Connect`/`Delete`/`Edit` enabled
  (screenshot `offline-context-menu-2026-10-04.png`).
- Opened existing chat "hey" (read-only): Send `disabled: true`
  (screenshot `offline-send-disabled-2026-10-04.png`).
- Boundary probes from the renderer: `window.chatsApi.addChat(1)` threw
  `Connect the database before creating chats`; `window.agentApi.prompt(11, 'test')`
  threw `Connect the database before sending messages`.

Online (after clicking Connect in the context menu, real MSSQL at
localhost:1433):

- Dot flipped to "Connected"; plus enabled.
- Clicked plus (real pointer event), filled the textarea, clicked Send.
  Chat persisted as ID 13; agent streamed tool calls and answered
  `**71 tables** in the connected database (AdventureWorks2025)`
  (screenshot `online-send-works-2026-10-04.png`).
- Live flip: clicking Disconnect while the chat was open immediately
  re-disabled plus and Send.

## Gotchas hit

- The sidebar rendered collapsed on this launch (persisted sidebar open
  state); toggled it open before driving.
- The first Send click landed under a sonner toast ("Connected to ...") and
  was swallowed; the retry after the toast expired went through. Toasts
  overlay the bottom-right where Send lives.
- Radix ContextMenu ignores `.click()` on the trigger; right-click needs
  dispatched pointer/mouse/contextmenu events. `drive.mjs click` works on
  the trigger but opens nothing visible in this layout.

## Cleanup

Both test chats (12 from the earlier ProviderClient run, 13 from this run)
were deleted; the user's chat 11 "hey" was opened read-only and untouched.
Teardown clean: 0 agent processes, ports 8000/5173/9222 free.

## Other checks

- `tsc --noEmit` (TypeScript 5.6.3 one-off): only the pre-existing
  `src/main.tsx` strictNullChecks error.
- eslint on the four touched files: only pre-existing findings (`@/` alias
  unresolved in eslint config, unused vars predating the change).