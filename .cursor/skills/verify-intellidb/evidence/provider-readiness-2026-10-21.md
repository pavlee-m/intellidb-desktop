# Provider readiness gating (2026-10-21)

Launched via `.cursor/skills/verify-intellidb/scripts/launch.sh` against scratch `$HOME=/tmp/intellidb-verify-home`.
No live MSSQL or ODBC driver. Connection create worked. Connect failed with unixODBC IM002.
Chat rows were seeded into the live zustand store so the open-chat UI could be driven.

## Unlocked chat, no provider enabled

Opened `Unlocked thread` with both integration flags off.
Composer textarea and Send were disabled.
Model trigger showed `No provider configured`.
Notice: `No model provider is enabled. Enable one in Settings → Integrations.`
Link: `a[href="/settings/integrations"]`.
Screenshot: `provider-readiness-no-provider-2026-10-21.png`.

## Locked Cursor chat, broken CLI

Enabled Cursor CLI, set binary to `/this/binary/does-not-exist`, returned home, opened `Cursor thread`.
Chat view opened (select no longer returns early).
Notice: `"/this/binary/does-not-exist" does not exist.`
Model trigger: `Model provider not configured`.
Textarea and Send disabled.
Screenshot: `provider-readiness-locked-cli-unavailable-2026-10-21.png`.

## Settings change without app reload

After enabling the broken Cursor binary, the already-selected unlocked thread switched from the no-provider notice to the CLI check message and `Model provider not configured`.
After pointing the binary at `/home/pavle/.local/bin/cursor-agent` and coming back, both chats dropped the notice and showed the default `Model` placeholder.
Screenshots: `provider-readiness-unlocked-cli-unavailable-2026-10-21.png`, `provider-readiness-locked-ready-2026-10-21.png`, `provider-readiness-unlocked-ready-2026-10-21.png`.

## New chat with a working provider

Opened an `id === -1` placeholder while Cursor CLI was enabled and the binary existed.
No provider notice. Model trigger stayed `Model` because `cursor-agent models` failed on missing login.
Textarea and Send stayed disabled because the connection was offline.
That matches today's disconnected-chat behavior.

## Resolver cases (imported in the renderer)

`null` settings → checking.
No flags on → no-provider.
Locked + flag off → no-provider naming Cursor CLI.
Locked + no result → checking.
Locked + fail → cli-unavailable with the check message.
Locked + pass → ready.
Unlocked + fail → cli-unavailable.
Unlocked + pass → ready.
Unlocked + waiting → checking.

## Not verified on this run

Send with a live connected database (no ODBC driver).
Model catalog defaulting when `cursor-agent models` succeeds (agent login required in this environment).
