# IntelliDB feature map

Index of user-facing features with verification recipes. One file per feature; each answers: what it is, how a user reaches it, how to drive it with the CDP harness (`scripts/drive.mjs`), and what end state proves it works.

| Feature | File | State |
|---|---|---|
| Manage connections (add / edit / delete) | [manage-connections.md](manage-connections.md) | Implemented |
| Connect / disconnect a database | [connect-disconnect.md](connect-disconnect.md) | Implemented (needs live MSSQL for success path) |
| Settings — theme | [settings-theme.md](settings-theme.md) | Implemented |
| Settings — integrations (opencode / Cursor CLI) | [settings-integrations.md](settings-integrations.md) | Implemented |
| Chat with a database | [chat.md](chat.md) | Chat CRUD + lazy load implemented (2026-10-02); messaging scaffolding only |

App surfaces: Electron renderer (React, routes `/`, `/settings/general`, `/settings/integrations`), main process IPC (`src/main.ts`), bundled backend on `127.0.0.1:8000` (`src/backend/sqlmcp.bin`). Config DB: `$HOME/.intellidb/config.db` (scratch home under verification — see SKILL.md).
