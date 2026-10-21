# CLI command availability check — verification evidence (2026-10-19)

Branch `feat/cli-command-availability-check` (commits 061436c → 0fb8eaa).
All proofs ran the real Electron UI over CDP using the verify-intellidb launch
procedure (`HOME=/tmp/intellidb-verify-home`, scratch MSSQL container later
replaced by the user's own sql2025 instance per user request).

## Proofs

### 1. Settings field validation (commit e3ad049)
- File: `evidence/cli-field-error-2026-10-19.png`
- Entering `no-such-opencode-xyz` into the opencode CLI binary field shows an
  error `<p role="alert">` ("Command ... was not found on your PATH ...") after
  the debounce window. Absent at 150 ms, present by 500 ms → per-keystroke
  validation is not happening.
- Typing a valid command clears the error. Entering a directory path gives the
  distinct "is not a file" error. Disabling the integration clears the error.

### 2. Pre-send gate in a new chat (commit a4470b0) — the core ask
- File: `evidence/preflight-toast-2026-10-19.png`
- With an invalid opencode binary configured and an OpenCode stub model
  selected, pressing Send in a new chat shows a sonner error toast
  (`Command "no-such-opencode-xyz" was not found on your PATH ...`) and
  `SELECT COUNT(*) FROM Chat` stays at 2 — no doomed chat row is created.
- Positive control: restoring a valid binary lets the preflight pass; the
  existing "OpenCode is not connected yet" stub-guard toast appears instead,
  and no row is created.

### 3. Main-process gate on an existing chat (commit 0fb8eaa)
- File: `evidence/gate-toast-existing-chat-2026-10-19.png` (screenshot taken
  after the toasts expired; DOM JSON captured the exact toast text below)
- Opening a seeded existing chat with `cursor_cli_binary` set to
  `no-such-cursor-xyz` makes `agent:connect` reject with
  `Error: Cursor CLI is unavailable: Command "no-such-cursor-xyz" was not found
  on your PATH ...` — previously this resolved silently with an empty client.
- The composer input is enabled after the failure (the catch path clears the
  waiting state; no stuck spinner). Chat count unchanged.
- Three identical toasts appeared because the mount effect fires a connect per
  chat/placeholder on the seeded home; each is a real rejected attempt, not a
  loop. Toast dedupe is pre-existing renderer behavior, out of scope here.

### 4. Spawn failure is loud (commit 0fb8eaa)
- With a valid binary path but no cursor auth in the scratch HOME,
  `cursor-agent` spawn failure surfaces as an `Authentication required` toast
  instead of the old silent empty-client resolution.

### 5. Chat-load gate on selection (2026-10-20)
- Files: `chat-load-blocked-toast-2026-10-20.png`, `chat-load-blocked-2026-10-20.png`,
  `chat-load-open-2026-10-20.png`
- Setup: connection `verify-db` added through the real dialog form (mssql,
  localhost, AdventureWorks2025, driver/TrustServerCertificate/LongAsMax query
  values) and connected to the user's sql2025 instance (green dot). Two chats
  seeded: "cursor chat A" (provider `cursor`) and "providerless chat B"
  (provider empty).
- Negative: with `cursor_cli_binary` = `no-such-cursor-xyz`, clicking
  "cursor chat A" shows the sonner toast `Command "no-such-cursor-xyz" was not
  found on your PATH ...`, the header stays "Home", and no ChatView mounts
  (no textarea). The chat is not loaded.
- Control 1: clicking "providerless chat B" (no provider recorded) opens the
  chat normally; the deep agent gate still rejects the mount connect loudly,
  which is the expected defense in depth.
- Control 2: restoring the default `cursor-agent` makes "cursor chat A" load
  (header shows the chat name, composer mounted). The auth toasts that follow
  are the scratch-HOME artifact (no `$HOME/.cursor` auth), proving the
  executable check passed and failures surface downstream.
- Chat table count unchanged (2) throughout.

## Environment / caveats
- `cursor-agent models` cannot load in the scratch HOME (no `$HOME/.cursor`
  auth), which is why the pre-send proof uses the opencode provider. This is a
  sandbox isolation artifact, not a product bug.
- Repo TypeScript (4.5.4) cannot parse its own tsconfig (pre-existing on main);
  `npx -p typescript@5.8.3 tsc --noEmit` is clean for the touched files.