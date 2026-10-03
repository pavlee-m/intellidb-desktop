# Chat agent over IPC — 2026-10-03

Verified the move of the Cursor ACP agent session from the renderer into the main process
(`src/agentHost.ts` + `agent:connect` / `agent:prompt` / `agent:activity` IPC).

## What was run

- `launch.sh` after forcing a rebuild of `.vite/build` (the stale bundle predated the change;
  `grep agent:connect .vite/build/main.js` confirmed 1 hit post-rebuild).
- Created connection "VerifyConn" through the real dialog (`[aria-label="Add connection"]`,
  `#name`/`#host`/`#username`/`#password`/`#database`, submit). Sidebar showed the row.
- Created a chat via the hover-revealed CirclePlus (needed a CDP mouseMoved before the click;
  one-off `/tmp/cdp-hover-click.mjs`). DB proof: `SELECT ID, Name, SessionID FROM Chat` → row 1.
- Selected the chat. First attempt hit a latent ChatView crash ("Maximum update depth exceeded"):
  the zustand selector's inline `?? []` returns a fresh reference per snapshot. Fixed with a
  module-level `NO_ENTRIES` constant; after reload the chat view mounted
  (textarea / #dangerous-queries / Send all present).
- Sent "Reply with exactly: ok" via `fill` + real click on the Send button.

## Observed

- Main log (`/tmp/intellidb-verify.log`): `Agent connect failed for chat 1 RequestError:
  Authentication required` — the scratch HOME has no `cursor agent login` credentials, so the
  spawned `agent` CLI cannot authenticate. Exactly one such line despite selecting the chat
  twice → `ensureAgent` is idempotent per chat id.
- User bubble rendered immediately; prompt rejected in main
  (`Error occurred in handler for 'agent:prompt': Error: Agent is not connected`) and surfaced
  in the renderer as a sonner toast:
  `Error invoking remote method 'agent:prompt': Error: Agent is not connected`.
- Screenshot: `chat-view-ipc-error-toast.png`.

A happy-path agent reply was not reproducible in this environment (CLI auth lives in the real
HOME; the harness isolates HOME by design). The failure path exercises the full
renderer → preload → main → agentHost → renderer round trip.
