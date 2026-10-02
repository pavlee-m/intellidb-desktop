---
name: verify-intellidb
description: Drive the IntelliDB Electron desktop app (React UI + bundled sqlmcp backend) end to end for verification proofs — launch, doctor, CDP driving, evidence, cleanup. Use whenever you need to launch IntelliDB and prove a feature works by exercising the real UI.
---

# Verify IntelliDB

IntelliDB is an Electron desktop app for chatting with databases. Three surfaces in one process tree:

1. **Renderer** — React 19 + TanStack Router (routes: `/`, `/settings/general`, `/settings/integrations`). This is what a user touches.
2. **Main process** — `src/main.ts` — spawns the backend, owns a SQLite config DB at `$HOME/.intellidb/config.db`, exposes IPC (`settings:*`, `connections:*`) via `src/preload.ts`.
3. **Backend** — `src/backend/sqlmcp.bin`, a bundled Python/FastMCP server listening on `http://127.0.0.1:8000` (endpoints used by main: `GET /connections`, `POST /connect_db`, `DELETE /close_db`).

There is no test suite or Playwright spec. The harness below drives the real renderer over Chrome DevTools Protocol (CDP).

## Launch

From the repo root (`desktop/intellidb`):

```bash
.cursor/skills/verify-intellidb/scripts/launch.sh
```

What it does: refuses to run if any app port is busy, creates a scratch `$HOME` (so the config DB lands in `/tmp/intellidb-verify-home/.intellidb/config.db`, **not** your real `~/.intellidb`), warms the backend binary (the app's health check only allows ~2.5s for backend boot; cold, it takes ~4s), then:

- starts the vite dev server for the renderer on `:5173` (the forge dev build of `main.js` loads `http://localhost:5173`),
- launches the **Electron binary directly** with `--remote-debugging-port=9222 --no-sandbox --disable-gpu` in its own session.

Why not plain `npm run start`? electron-forge does not forward CLI switches to Electron, and on this machine the kernel blocks Chromium's namespace sandbox — the GPU process fails to launch and the app dies silently. `--no-sandbox --disable-gpu` are verification-environment workarounds, not app requirements. `.vite/build` must exist (produced by any prior `npm run start`; the script triggers one if missing).

It is ready when all three succeed:

- `curl http://127.0.0.1:9222/json/version` answers (CDP up),
- `node .cursor/skills/verify-intellidb/scripts/drive.mjs eval "document.querySelector('#root').children.length > 0"` prints `true` (renderer mounted),
- port 8000 is owned by `sqlmcp.bin` (check with `doctor.sh`).

App stdout/stderr streams to `/tmp/intellidb-verify.log` (vite: `/tmp/intellidb-verify-vite.log`). The app quits itself if the backend binary is missing or unresponsive — "Failed to start backend" in the log means a backend problem, not a UI problem.

**Teardown** (always run when done, even after failures):

```bash
.cursor/skills/verify-intellidb/scripts/cleanup.sh
```

## Doctor

Run first whenever anything looks off (app won't start, drive commands hang, port conflicts):

```bash
.cursor/skills/verify-intellidb/scripts/doctor.sh
```

Read-only checks: backend binary present and executable in `src/backend/`, something listening on 8000 and whether it is `sqlmcp.bin`, CDP port 9222 answering, Electron process running from this repo. Exit code 0 = worth driving.

## Drive

All UI driving goes through the CDP helper (Node ≥ 22, uses the global `WebSocket`):

```bash
D=.cursor/skills/verify-intellidb/scripts/drive.mjs
node $D eval   "<js expression>"            # Runtime.evaluate, prints result JSON
node $D click  "<css selector>"             # real CDP mouse press/release at element center
node $D fill   "<css selector>" "<text>"    # React-safe: native value setter + input/change events
node $D screenshot "<output-path>.png"      # captures the app window
node $D pick                                # dump interactive elements (ids, aria-labels, text)
```

Stable handles in this app (prefer these, not coordinates):

- **Add connection**: `[aria-label="Add connection"]` (plus button in sidebar) → dialog fields by id: `#name`, `#DBMS` (Radix Select, only `mssql` enabled), `#host`, `#username`, `#password`, `#database`, submit button `form#create-connection-form button[type="submit"]`.
- **Connection row**: rendered per connection inside `.SidebarMenu` — status dot `span[aria-label="Disconnected" | "Connecting" | "Connected"]`, name in a `span.truncate`.
- **Context menu** (connect/disconnect/edit/delete): right-click the connection row (Radix `ContextMenu`); menu items are `[role="menuitem"]` with text `Connect`, `Disconnect`, `Delete`, `Edit`.
- **Settings nav**: sidebar footer link `a[href="/settings/general"]`, `a[href="/settings/integrations"]`.
- **Theme**: `/settings/general` button containing text `Switch to Dark` / `Switch to Light`.
- **Integrations**: checkboxes next to text `Enable`, inputs `#opencode-binary` and `#cursor-cli-binary`.
- **Toasts**: `sonner` toasts in `[data-sonner-toast]` (e.g. `Connected to <name>`).

Gotchas when driving:

- Radix `Select` and `ContextMenu` need **real** pointer events — use `node $D click`, never `el.click()` for triggers and menu items.
- `fill` works on the controlled inputs (TanStack Form); after filling, verify with `eval "document.querySelector('#name').value"`.
- Route changes go through TanStack Router; `eval "location.pathname"` tells you where you are. Navigate by clicking links, or `eval "window.history.pushState({}, '', '/settings/general'); window.dispatchEvent(new PopStateEvent('popstate'))"`.
- The app blocks Ctrl/Cmd+R (`before-input-event` in `src/main.ts`); don't rely on reload.

## Evidence

Capture to `.cursor/skills/verify-intellidb/evidence/` (create it; it is scratch-safe and survives cleanup). A proof of a feature needs all of:

1. **The action, through the real UI** — a screenshot after the interaction (`node $D screenshot ...`).
2. **The visible result** — DOM state, e.g. `eval "[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent)"`.
3. **The side effect on disk** — the config DB is the source of truth. Query it with the project's own sqlite driver:

   ```bash
   node -e "require('sqlite3').verbose().Database(...)"
   ```

   against the DB in the scratch home (`/tmp/intellidb-verify-home/.intellidb/config.db` when launched via `launch.sh`). Example: after creating a connection, `SELECT ID, Name, DBMS, Host FROM Connection;` must show the row.

4. A short `evidence/<feature>-<date>.md` note listing what was run and what was observed.

Do not fake the user path: creating a connection by calling `window.connectionsApi.addConnection(...)` from `eval` is NOT a proof — that skips the dialog, the form validation, and the IPC bridge. Reserve `eval` for reading state and triggering navigations.

The only backend that should exist during a run is the one the app spawned (the doctor confirms). If a feature needs a live MSSQL server (e.g. `connections:connect`), and none is available, verify the honest failure path instead: a failed connect must surface a `toast.error` and the status dot must stay red — then say so in the evidence note. Do not stand up a mock on port 8000; the app owns that port.

## Cleanup

```bash
.cursor/skills/verify-intellidb/scripts/cleanup.sh
```

Order of operations (the script does this):

1. Graceful quit: `node .../drive.mjs eval "window.close()"` — this triggers `before-quit` in the main process, which closes the DB and kills the backend process tree. Wait for CDP port 9222 to stop answering.
2. Kill the electron and vite dev server processes we started — by recorded PID and by the unique launch-time cmdline patterns (`remote-debugging-port=9222`, `renderer.config.mts`); SIGTERM, then SIGKILL.
3. Kill only `sqlmcp.bin` PIDs that appeared after launch (recorded in `/tmp/intellidb-verify.pre-sqlmcp` at launch time). Never kill by name alone — if the doctor showed sqlmcp running *before* launch, that instance belongs to the user.
4. Delete the scratch home `/tmp/intellidb-verify-home` and the log files.

**Never** delete `~/.intellidb` — that is the user's real data, present only if `launch.sh` was bypassed.

Verify after cleanup: `pgrep -af 'sqlmcp|electron'` shows nothing from this run, port 8000 and 9222 are free, and the evidence files still exist under `.cursor/skills/verify-intellidb/evidence/`.

## Helpers

- `scripts/launch.sh` — start the app isolated; prints readiness progress.
- `scripts/doctor.sh` — read-only health check.
- `scripts/drive.mjs` — CDP driver (`eval`, `click`, `fill`, `screenshot`, `pick`). Env: `INTELLIDB_CDP_PORT` (default 9222).
- `scripts/cleanup.sh` — graceful teardown; safe to run twice.
- `scripts/db-query.mjs <sql>` — query the config DB of the scratch home (falls back to `~/.intellidb` with `--real-home`, read-only intent — prefer `SELECT`).

## Isolation rules

- **One instance at a time.** The backend hard-codes port 8000, the renderer dev server uses 5173, and CDP uses 9222. Two instances race for the backend: the second one's `startBackend()` health-checks against the first instance's server, so you get cross-contaminated state. If `doctor.sh` reports sqlmcp running and CDP down, a user instance may be live — stop and ask.
- **Scratch `$HOME` by default.** All app state (config DB) derives from `os.homedir()` in `src/main.ts`. `launch.sh` sets `HOME` to a scratch dir so proofs never touch real data. To verify against real data deliberately, set `INTELLIDB_SCRATCH_HOME="$HOME"` and skip DB mutation proofs.

## Feature map

See `features/README.md` for the index; one file per feature with user POV, driving recipe, and gotchas. Keep it updated when routes or dialogs change — the map is the verification source of truth.
