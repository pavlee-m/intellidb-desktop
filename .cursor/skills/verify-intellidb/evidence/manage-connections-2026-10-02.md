# Proof: manage connections — create (2026-10-02)

## What was run

```bash
.cursor/skills/verify-intellidb/scripts/launch.sh            # READY: CDP :9222, renderer, backend :8000
node drive.mjs click '[aria-label="Add connection"]'
node drive.mjs fill '#name' 'Verify Test Conn'                # plus #host, #username, #password, #database
node drive.mjs click 'form#create-connection-form button[type="submit"]'
node drive.mjs screenshot evidence/manage-connections-after.png
.cursor/skills/verify-intellidb/scripts/db-query.mjs "SELECT ID, Name, DBMS, Host, Username, Password, Database FROM Connection;"
.cursor/skills/verify-intellidb/scripts/cleanup.sh
```

## Observed

- Dialog opened via the real `+` button; submit closed it (`dialogOpen: false`).
- Screenshot after (`manage-connections-after.png`): sidebar row **Verify Test Conn** with red status dot (`span[aria-label="Disconnected"]`) — created ≠ connected. Before-shot: `manage-connections-before.png` (empty connections list).
- Config DB of the scratch home (`/tmp/intellidb-verify-home/.intellidb/config.db`) contained the exact row:
  `{ID: 1, Name: "Verify Test Conn", DBMS: "mssql", Host: "localhost", Username: "sa", Password: "Secret123!", Database: "master"}`.
- No toast on create — toasts fire on connect/disconnect only (checked `src/routes/index.tsx`), so absence of a toast is expected.

## Result

PASS — real user path (dialog → TanStack Form → IPC `connections:add` → SQLite → zustand store → sidebar) verified end to end.

## Environment notes

- Electron run directly with `--no-sandbox --disable-gpu` (this machine blocks Chromium's namespace sandbox; forge does not forward CLI switches). Renderer served by vite dev server on :5173; backend sqlmcp.bin (app-spawned) on :8000; scratch `$HOME` isolated.
