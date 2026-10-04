# Chat wait gating, offline history fetch, add-chat tooltip - 2026-10-04 (round 2)

Fresh forge build of `.vite/build/main.js` was required: vite HMR covers only the renderer,
so the first offline run hit a stale `agent:connect` gate. Launcher: `launch.sh` (scratch
HOME mirrored with the user's real `config.db`), window resized to 1280px via
`window.resizeTo` (it booted at 376px, which flips the sidebar into mobile offcanvas).

## Observed

- **Offline fetch attempt.** Opening "First MCP Test" while the connection dot was red no
  longer throws "Connect the database before using the agent" (0 occurrences of that string
  in the app log this run). The renderer calls `agent:connect`, the main process spawns the
  ACP agent, initialize rejects with "Authentication required" (scratch HOME has no
  `cursor agent login`), the wait clears, and the thread renders with no hang. The history
  replay itself needs real agent credentials.
- **Composer locked while loading activities.** 50ms DOM sampler anchored to the click:
  opening "hey" offline showed `{sp:true, ta:disabled, Send:disabled}` at 50ms and cleared at
  1400ms. Opening "New chat" online showed composer enabled at 0ms, `{sp:true, ta:disabled,
  Send:disabled}` at 50ms, and `{sp:false, ta:enabled}` at 1350ms. The wait only spans a
  fresh agent spawn; a chat whose agent entry already exists settles instantly.
- **Add-chat plus tooltip.** Offline: button disabled, wrapper cursor `not-allowed`, wrapper
  right-aligned within the row (gap 0), and hover (dispatched pointer events) opens the
  tooltip "Connection is not active". Online: button enabled, rendered bare (no span wrap,
  cursor auto).
- **DB side effect.** No new rows this round; chats 11/14/15 came from the mirrored config DB.

## Notes

- The stale-bundle trap: `npx vite build --config vite.main.config.mts` writes to `dist/`
  (the standalone config has no `outDir`; forge injects it), so it does not refresh
  `.vite/build/main.js`. A short `timeout 90 npm run start` rebuilds the real bundle; it
  leaves an orphaned `sqlmcp.bin` on port 8000 that must be killed before `launch.sh`.
- Spinner size/centering and the offline composer tooltip were proven in round 1
  (`chatview-ux-2026-10-04.md`) and are unchanged.

## Artifacts

- `round2-online-wait.png` - settled state after the online wait (composer enabled again).
- `offline-tooltip.png`, `scrolled-chat.png` - round 1 evidence, still valid.