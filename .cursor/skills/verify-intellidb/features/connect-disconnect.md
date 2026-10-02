# Connect / disconnect a database

## Sub-features

- Connect: main process POSTs to backend `POST /connect_db`, stores the returned `backendConnectionId`, status dot turns green.
- Disconnect: main process DELETEs `DELETE /close_db`, clears the id, dot turns red.

## How to get to it (user POV)

On `/` (Home), right-click a connection row in the sidebar → **Connect** (or **Disconnect** when connected). Success shows a sonner toast ("Connected to …" / "Disconnected from …"); the small dot next to the connection name changes color.

## Driving it with CDP

```bash
D=.cursor/skills/verify-intellidb/scripts/drive.mjs
# right-click the row (context menu needs a real right-press):
node $D eval "" # no right-click helper — see Gotchas
```

There is no right-click command in `drive.mjs`. Two options: add `button: 'right'` mouse events the same way `click` works (extend `drive.mjs` with a `contextmenu` command), or verify the connect path end-to-end and observe the resulting state:

```bash
# success path (requires a reachable MSSQL server for the typed credentials)
# observe status dot and backend state:
node $D eval "document.querySelector('span[aria-label=\"Connected\"]') !== null"
curl -s http://127.0.0.1:8000/connections   # backend reports the live connection
```

Proof of end state:

1. Toast `[data-sonner-toast]` text contains `Connected to <name>`.
2. Status dot aria-label flips `Disconnected` → `Connected` (green `bg-green-500`).
3. `curl http://127.0.0.1:8000/connections` shows the backend-side connection (this is the real side effect outside the app).

## Gotchas

- **Needs a live MSSQL server** for the success path. Without one, verify the honest failure path: `toast.error` appears and the dot stays red — record that in the evidence note instead of claiming success.
- While connecting, the dot shows `Connecting` with a spinner; `ContextMenuItem` is disabled during that phase.
- Disconnect when never connected is a no-op in main (`connections:disconnect` returns early if no `backendConnectionId`) but the UI still toasts success — known quirk, don't file it as a new bug without checking `src/main.ts`.
- The backend keeps its own state; a killed app without graceful quit leaks backend connections. `cleanup.sh` handles our instance; check `curl http://127.0.0.1:8000/connections` afterwards.
