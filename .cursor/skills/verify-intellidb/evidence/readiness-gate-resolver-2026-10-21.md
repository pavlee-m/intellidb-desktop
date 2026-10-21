# Chat open gate through resolveProviderReadiness (2026-10-21)

Commit `e2e219d` (`fix(chat): refuse to open a chat whose provider is disabled or unavailable`) on `feat/cli-command-availability-check`.
Launched with `.cursor/skills/verify-intellidb/scripts/launch.sh` (first launch attempt failed its 2.5s backend health window; second attempt was READY). Scratch `$HOME=/tmp/intellidb-verify-home`. Driven over CDP with `scripts/drive.mjs`.

Contract under test. Selecting an existing chat whose provider is unavailable (disabled integration OR broken CLI binary) must show a sonner `toast.error` and must not open the chat. A chat with a working provider opens as before.

Fixtures. No live MSSQL in this run, so the connection `gate-probe` was created through the real Add-connection dialog (host localhost, sa, never connected) and the three chat rows were seeded directly into the scratch config DB (`/tmp/intellidb-seed-chats.mjs`, sqlite3 INSERT). Seeding skips the real send path, which the 2026-10-21 disabled-provider run already proved; the action under proof here, clicking the chat in the sidebar and reading the toast and header, went through the real UI. Settings went through the real Integrations page (checkbox saves immediately, binary persists on blur), verified in the scratch DB after each change.

## Case 1. Disabled provider, valid binary

`cursor_cli_integration_enabled=false`, `cursor_cli_binary=/home/pavle/.local/bin/cursor-agent` (real executable). Header was `Home`. Clicked `gate-probe A` (Provider `cursor`).

- Toast: error, text `Cursor CLI is not enabled. Enable it in Settings → Integrations.` (the resolver message, unmodified).
- Open: no. Header stayed `Home`.

Screenshot `readiness-gate-disabled-provider-2026-10-21.png`. Pass.

## Case 2. Enabled provider, broken binary

`cursor_cli_integration_enabled=true`, binary `/this/binary/does-not-exist`. Header was `Home`. Clicked `gate-probe B`.

- Toast: error, text `"/this/binary/does-not-exist" does not exist.`
- Open: no. Header stayed `Home`.

Screenshot `readiness-gate-broken-binary-2026-10-21.png`. Pass.

## Case 3. Enabled provider, working binary

Binary restored to `/home/pavle/.local/bin/cursor-agent`. Header was `Home`. Clicked `gate-probe A`.

- Open: yes. Header became `gate-probe A`, composer textarea present. No gate toast.
- Unrelated toast appeared from the background `models:cursor` fetch: scratch HOME has no Cursor login. Pre-existing, not the gate.

Screenshot `readiness-gate-working-binary-2026-10-21.png`. Pass.

## Case 4. Disabled again while another chat is open

After Case 3, `cursor_cli_integration_enabled=false` via the page. Clicked `gate-probe B` with `gate-probe A` open.

- Toast: error, `Cursor CLI is not enabled. Enable it in Settings → Integrations.`
- Open: no. Header stayed `gate-probe A`, so B did not open.
- Two `agent:connect` error toasts came from chat A's background connect against the login-less scratch home. Pre-existing, not the gate.

Screenshot `readiness-gate-disabled-again-2026-10-21.png`. Pass.

## Case 5. Regression, providerless chat while provider disabled

Clicked the seeded Provider `''` chat `gate-probe no-provider` with the integration disabled. Opened normally: header `gate-probe no-provider`, textarea present. Screenshot `readiness-gate-no-provider-chat-opens-2026-10-21.png`. Pass.

The `-1` new-chat placeholder path was not re-driven in this run: creating the placeholder requires a connected backend (live MSSQL), and both `-1` and Provider `''` skip the gate before any readiness call. The 2026-10-21 restore run (`chat-open-gate-restore-2026-10-21.md`, evidence on `92092aa`) covers it, and this commit does not touch that path.

## Typecheck

`npx -p typescript@5.6.3 tsc --noEmit --skipLibCheck`: one diagnostic, the known pre-existing `src/main.tsx(10,29)` strictNullChecks error. None in `src/routes/index.tsx`.

## Cleanup

`.cursor/skills/verify-intellidb/scripts/cleanup.sh`