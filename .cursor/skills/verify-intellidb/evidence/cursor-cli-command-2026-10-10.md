# Cursor CLI command on session create

Date: 2026-10-10

Scratch home: `/tmp/intellidb-verify-home`

## What ran

1. Rebuilt `.vite/build/main.js` from the working tree. The bundle contains `getCursorCliCommand` and `spawn(this.command, ["--model", "composer-2.5", "acp"])`.
2. Started the renderer on port 5173 and Electron with `--remote-debugging-port=9222` and `HOME=/tmp/intellidb-verify-home`.
3. The app's backend health check allows about 2.5 seconds. A cold `sqlmcp.bin` missed that window and Electron quit with `Failed to start backend`. A pre-started backend on port 8000 let the next launch log `{ connections: [] }`.
4. Clicked Settings, then Integrations. Enabled the Cursor checkbox. Set `#cursor-cli-binary` to `/tmp/intellidb-cursor-cli-proof` and blurred the field.
5. Queried the scratch database.
6. New chat stays disabled until a database connection is online. No MSSQL server was available. Called `window.agentApi.connect(2, '')`, the same IPC `ChatView` uses.

The proof binary is a script that appends its arguments to `/tmp/intellidb-cli-spawn-proof.log` and then execs `~/.local/bin/cursor-agent`.

## What was observed

- `Settings` row: `cursor_cli_binary` = `/tmp/intellidb-cursor-cli-proof`, `cursor_cli_integration_enabled` = `true`.
- The integrations field showed `/tmp/intellidb-cursor-cli-proof`. Screenshot: `cursor-cli-binary-2026-10-10.png`.
- The proof log received two lines, both `--model composer-2.5 acp`. The script only runs if the stored path is the executable. The second line is the fresh-session retry after the first connect failed.
- Electron logged `Authentication required. Please run 'cursor agent login'` for chat 2. The scratch home has no Cursor login, so the ACP session did not finish. The spawned command is still the stored path.
