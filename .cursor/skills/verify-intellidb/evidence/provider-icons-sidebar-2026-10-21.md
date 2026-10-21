# Sidebar provider icons — 2026-10-21

Feature: chat rows in the sidebar render the provider's icon before the chat name; chats with no provider yet render a muted question mark. Change: `src/components/index/ChatItem.tsx` only (commit `6a9a38c`).

Launched with `.cursor/skills/verify-intellidb/scripts/launch.sh` against scratch `$HOME=/tmp/intellidb-verify-home`. Driven over CDP with `scripts/drive.mjs`. The unrelated in-flight `modelsStore` rename was stashed for the run (`git stash push -u`) and popped after cleanup; the working tree verified is `main` + the icon commit.

1. The user's in-flight tree was broken (`ChatView.tsx` imports the deleted `cursorModelsStore`), so verification ran on a clean tree with only the icon change.
2. First launch attempt died at backend warm-up ("Killed", memory pressure at ~8G available of 32G); second launch succeeded.
3. Created connection `AdventureWorks` through the real dialog (operator-provided localhost credentials), then set query values through the real Edit dialog (`driver=ODBC Driver 18 for SQL Server`, `TrustServerCertificate=yes`, `LongAsMax=Yes`). Connect succeeded: toast `Connected to AdventureWorks`, status dot `Connected`. Query values confirmed in the scratch DB (`Connection.sqlalchemy_query`).
4. Created a new chat via the connection context menu → `New chat`. Sidebar row renders the muted `lucide-circle-question-mark` svg with `aria-label="No provider selected"` before the name (`provider-icons-3-new-chat.png`).
5. Enabled Cursor CLI integration via the real checkbox on `/settings/integrations`; copied `~/.config/cursor/auth.json` into the scratch home (same environment setup as prior evidence notes). Opened the placeholder chat, picked model `Composer 2.5` in the model select, typed `Show me the tables in this database.`, clicked Send through the real button.
6. Send path set the provider for real: scratch DB `Chat` row shows `Provider='cursor'`, `SessionID=9825bdfa-...`. The sidebar row re-rendered with `<img alt="Cursor provider" class="h-4 w-4 shrink-0 rounded-sm bg-neutral-900 p-px" src="/src/assets/cursor.svg">` before the name (`provider-icons-4-cursor-chat.png`, agent answer streaming). No chat rows were seeded; both rows came through the real UI.

The OpenCode logo branch (`plain h-4 w-4` img, fill currentColor) is the same registry lookup and was not separately exercised; creating an OpenCode chat would need an OpenCode session. Noted as unexercised rather than verified.