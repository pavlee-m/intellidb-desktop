# Chat open gate, disabled provider (2026-10-21)

Commit `92092aa` (`fix(chat): refuse to open a chat whose provider CLI is unavailable`) on `feat/cli-command-availability-check`.
Launched with `.cursor/skills/verify-intellidb/scripts/launch.sh` against scratch `$HOME=/tmp/intellidb-verify-home`.
Driven over CDP with `scripts/drive.mjs`. Hover and right-click used `/tmp/intellidb-drive-extra.mjs` because `drive.mjs` only left-clicks.
No code was changed.

Live MSSQL used the operator-provided AdventureWorks2025 credentials on localhost (ODBC Driver 18, TrustServerCertificate=yes, LongAsMax=Yes). Connect succeeded. Backend reported `mssql://sa@localhost/AdventureWorks2025`.

Scratch HOME has no Cursor login. `~/.config/cursor/auth.json` was copied into the scratch home so the real Send path could pick a model. No chat rows were seeded.

Expected behavior under test. Selecting an existing chat whose provider is unavailable must show a sonner toast and must not open that chat in the main pane.

## Setup

```
.cursor/skills/verify-intellidb/scripts/launch.sh
.cursor/skills/verify-intellidb/scripts/doctor.sh
```

Settings → Integrations. Enabled Cursor CLI. Binary set to `/home/pavle/.local/bin/cursor-agent` (an existing executable).
Add connection dialog created `verify-aw` (mssql, localhost, sa, AdventureWorks2025, three query values).
Right-click → Connect. Toast `Connected to verify-aw`. Status dot `Connected`.
Right-click → New chat after the first plus-created thread. Composer filled with `gate-disabled-provider ping`. Send.
Scratch DB after send:

```
SELECT ID, Name, Provider FROM Chat;
```

Row `1 / gate-disabled-provider ping / cursor`.
The sidebar store still showed `New chat` until a Rename dialog set the same name. Header then showed `gate-disabled-provider ping`.

## Case A. Disabled provider

Cursor CLI integration enabled, binary path valid. Persist the cursor chat as above.
Settings → Integrations. Uncheck Cursor CLI Enable. DB then had `cursor_cli_integration_enabled=false` and `cursor_cli_binary=/home/pavle/.local/bin/cursor-agent`.
Returned to `/`. Opened a `New chat` placeholder via the connection context menu so the header was `New chat`.
Clicked the sidebar button `gate-disabled-provider ping`.
Screenshot `chat-open-gate-disabled-provider-2026-10-21.png`.

DOM 0.5s after the click:

```
header: "Toggle Sidebar\ngate-disabled-provider ping"
headerHasChatName: true
[data-sonner-toast] count: 0
[data-sonner-toast] text: []
[role=status]: "Cursor CLI is not enabled. Enable it in Settings → Integrations."
sidebar chats: ["verify-aw", "gate-disabled-provider ping"]
textarea: true
```

Observed:

- Toast. No. `[data-sonner-toast]` count was 0.
- Chat opened. Yes. Header showed `gate-disabled-provider ping`. The `New chat` placeholder left the sidebar. The main pane showed the persisted thread, an in-view notice, and a Settings → Integrations link.

This matches the code-reading hypothesis. The chat opens with an in-view notice and no toast. That is the defect against the contract (toast and no-open).

## Case B. Wrong CLI path

Settings → Integrations. Re-enabled Cursor CLI. Binary set to `/this/binary/does-not-exist` (saved on blur). Field error `"/this/binary/does-not-exist" does not exist.`
Returned to `/`. Waited until a leftover `models:cursor` ENOENT toast expired.
Opened a `New chat` placeholder. Header `New chat`. Clicked `gate-disabled-provider ping`.
Screenshot `chat-open-gate-wrong-cli-path-2026-10-21.png`.

DOM 0.5s after the click:

```
header: "Toggle Sidebar\nNew chat"
headerHasChatName: false
[data-sonner-toast] count: 1
[data-sonner-toast] type: error
[data-sonner-toast] text: "\"/this/binary/does-not-exist\" does not exist."
[role=status]: "\"/this/binary/does-not-exist\" does not exist."
sidebar chats: ["verify-aw", "gate-disabled-provider ping", "New chat"]
textarea: true
```

Observed:

- Toast. Yes. Error toast `"/this/binary/does-not-exist" does not exist.`
- Chat opened. No. Header stayed `New chat`. The clicked name did not appear as the header. The `New chat` row stayed in the sidebar.
- The still-open new-chat view also showed the same missing-binary notice in `[role=status]`. That is the in-view readiness gate on the placeholder, not the clicked chat opening.

Pass against the contract.

## Cleanup

```
.cursor/skills/verify-intellidb/scripts/cleanup.sh
```

`cleanup.sh` quit Electron and vite. Port 8000 was free. Port 9222 stayed bound because the Send path had spawned `cursor-agent` ACP workers (HOME=`/tmp/intellidb-verify-home`, PGID of the verify Electron process) that inherited the debug socket. Those leftover PIDs were killed after cleanup. Ports 8000 and 9222 were then free. CDP `/json/version` did not answer. Evidence files remain under `.cursor/skills/verify-intellidb/evidence/`.
