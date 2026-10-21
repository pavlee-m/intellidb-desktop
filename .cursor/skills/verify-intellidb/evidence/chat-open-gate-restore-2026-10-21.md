# Chat open gate restore (2026-10-21)

Commit `92092aa` on `feat/cli-command-availability-check`.
Launched with `.cursor/skills/verify-intellidb/scripts/launch.sh` against scratch `$HOME=/tmp/intellidb-verify-home`.
Driven over CDP with `scripts/drive.mjs`. Hover and right-click used `/tmp/intellidb-drive-extra.mjs` because `drive.mjs` only left-clicks.

Live MSSQL used the operator-provided AdventureWorks2025 credentials on localhost (ODBC Driver 18, TrustServerCertificate=yes, LongAsMax=Yes). Connect succeeded. Backend reported `mssql://sa@localhost/AdventureWorks2025`.

Scratch HOME has no Cursor login. `cursor-agent models` failed until `~/.config/cursor/auth.json` was copied into the scratch home. That was environment setup so the real Send path could pick a model. No chat rows were seeded.

## Setup commands

```
.cursor/skills/verify-intellidb/scripts/launch.sh
.cursor/skills/verify-intellidb/scripts/doctor.sh
```

Settings → Integrations. Enabled Cursor CLI. Binary set to `/home/pavle/.local/bin/cursor-agent`.
Add connection dialog created `verify-aw` (mssql, localhost, sa, AdventureWorks2025, three query values).
Right-click → Connect. Toast `Connected to verify-aw`. Status dot `Connected`.
Hover the row, click `Add item to verify-aw`. Header became `New chat`.
After auth copy and a settings remount, the model picker defaulted to Auto.
Filled the composer with `gate-restore ping` and clicked Send.
Scratch DB after send:

```
SELECT ID, Name, Provider FROM Chat;
```

Row `1 / gate-restore ping / cursor`.
The sidebar store still showed `New chat` until a Rename dialog set the same name. Header then showed `gate-restore ping`.
Clicked plus again so the open view was a `New chat` placeholder.

## Proof 1. Toast and no-open on broken CLI

```
# Settings → Integrations
fill #cursor-cli-binary /this/binary/does-not-exist
blur
# back to /
click the sidebar button "gate-restore ping"
screenshot chat-open-gate-broken-cli-2026-10-21.png
```

Observed:

- `[data-sonner-toast]` text. `"/this/binary/does-not-exist" does not exist.`
- Header stayed `New chat`.
- Main pane text did not contain `gate-restore ping`.
- The still-open new-chat view also showed the same missing-binary notice in `[role=status]`. That is the in-view readiness gate on the placeholder, not the clicked chat opening.

Pass.

## Proof 2. Working CLI opens

```
fill #cursor-cli-binary /bin/true
blur
# back to /
# waited until leftover models toasts expired
click the sidebar button "gate-restore ping"
screenshot chat-open-gate-working-cli-2026-10-21.png
```

Observed:

- Header became `gate-restore ping`.
- No `[data-sonner-toast]` after the click.
- Chat view mounted. Textarea present.

Difference. Switching the binary to `/bin/true` first raised `Error invoking remote method 'models:cursor': ... missing the Available models line` because `/bin/true` is not cursor-agent. That toast expired before the click. It is not the `checkCliCommand` failure toast from proof 1.

Pass.

## Proof 3. New-chat regression

```
# Settings → Integrations
uncheck Cursor CLI Enable
# both integration flags false in Settings
# back to /
hover connection row
click [aria-label="Add item to verify-aw"]
screenshot chat-open-gate-new-chat-no-provider-2026-10-21.png
```

Observed:

- Header `New chat`.
- `[role=status]`. `No model provider is enabled. Enable one in Settings → Integrations.`
- Textarea disabled. Send disabled.
- Model trigger `No provider configured`.
- Link `a[href="/settings/integrations"]` present.

Pass.

## Cleanup

```
.cursor/skills/verify-intellidb/scripts/cleanup.sh
```

`cleanup.sh` quit Electron and vite. Port 8000 was free. Port 9222 stayed bound because the Send path had spawned `cursor-agent` ACP workers that inherited the debug socket. Those three leftover PIDs were killed after cleanup. Ports 8000 and 9222 were then free. CDP `/json/version` did not answer. Evidence files remain under `.cursor/skills/verify-intellidb/evidence/`.
