# ChatView UX improvements - verification 2026-10-04

App launched via `launch.sh` (scratch HOME mirrored with the user's real `config.db` so the
existing "local SQL Server" connection and chats were present). Driven over CDP with
`drive.mjs`; a right-click over raw CDP `Input.dispatchMouseEvent` opened the Radix context
menu (`drive.mjs` only does left clicks).

## Observed

- **Chat loads with no database connection.** Opened "First MCP Test" while the connection
  was red. The message area rendered immediately ("Messages will appear here"), no spinner
  hang. Textarea disabled, wrapper cursor `not-allowed`, Send button `disabled`. Screenshot:
  `offline-tooltip.png` (tooltip visible).
- **Tooltip.** Hover was produced by dispatching `pointerover/pointerenter/pointermove` on the
  tooltip trigger wrapper. `[data-slot=tooltip-content]` rendered with the text
  "Connection is not active" (both the textarea and the Send button wrappers carry the same
  tooltip; the textarea one is visible in the screenshot).
- **Waiting spinner.** Caught with a MutationObserver while switching to the chat "hey":
  size 24x24 (size-6, default is 16), wrapper class `flex flex-1 items-center justify-center`
  spanning the full message area. On reconnect with entries already present, no spinner shows
  and the chat loads instantly (wait flag cleared by connect resolution and by chatId change).
- **Send/Stop control.** React flushes discrete events synchronously, so a bubble-phase click
  listener on `document` captured the button at the send instant: `{"t":"Stop","d":false}` -
  the button becomes Stop and stays ENABLED while a prompt is in flight (the old code
  disabled it, making cancel impossible). Clicking the enabled Stop during flight dispatched
  `handleCancel`; state settled back to `Send` (disabled only because the input was empty).
- **Scroll + pinned composer.** Sent 8 long messages through the real UI (fill + click Send).
  Result: `documentElement` NOT scrollable (`docScrollable: false`), message pane scrollable
  (`scrollHeight > clientHeight`, scrollTop 3074, auto-scrolled to bottom), composer bottom
  edge exactly at window height (1005 == winH). Screenshot: `scrolled-chat.png`.
- **DB side effect.** Scratch config DB (`/tmp/intellidb-verify-home/.intellidb/config.db`)
  gained chat ID 15 ("New chat") created through the sidebar plus button. Chats 11/14 came
  from the mirrored user DB.

## Environment limits (honest failures)

- The ACP agent (composer-2.5) requires `cursor agent login`; the scratch HOME has no agent
  credentials, so every prompt rejected with "Agent is not ready" and a toast appeared
  (correct error surfacing). Streaming agent replies, a long-lived Stop state, and a real
  agent-initiated cancel could not be exercised end to end. The Stop-mode UI path was proven
  by capturing the button state at the click instant and by clicking the enabled Stop during
  the flight window; the main-process `agent:cancel` handler mirrors the verified `agent:prompt`
  plumbing.
- Two early `launch.sh` runs failed with "Failed to start backend": the backend boot exceeded
  the app's 2.5s health-check window (5 x 500ms). Warm page cache made later runs pass. A
  pre-existing app bug surfaced there: `before-quit` dereferences `dbManager` before
  `initDatabase` when the backend fails, throwing `Cannot read properties of undefined
  (reading 'closeConnection')`. Not touched in this change; reported here.

## Artifacts

- `offline-tooltip.png` - offline chat, disabled composer, tooltip.
- `scrolled-chat.png` - scrollable pane, pinned composer, connected dot green.