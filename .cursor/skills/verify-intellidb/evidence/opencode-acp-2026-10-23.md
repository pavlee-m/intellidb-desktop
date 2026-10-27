# OpenCode ACP, 2026-10-23

Scratch home `/tmp/intellidb-verify-home`. The app was launched with `.cursor/skills/verify-intellidb/scripts/launch.sh` after rebuilding `.vite/build/main.js` and `preload.js`.

OpenCode auth files were copied into the scratch home. `opencode models` failed there until `opencode.db` was symlinked to the real database at `~/.local/share/opencode/opencode.db`. The empty scratch database could not create its `workspace` table. The chat session created by this run is in that real database.

## What was clicked

1. Settings, Integrations. The OpenCode Enable checkbox was turned on. The binary field stayed `opencode` and showed no error. Screenshot `opencode-integrations-enabled-2026-10-23.png`.
2. A connection named AdventureWorks was created for `localhost` / `AdventureWorks2025` with the ODBC driver and the two certificate and long-as-max options. `Settings.opencode_integration_enabled` is `true`. The connection row is in `Connection`.
3. The connection context menu Connect item was clicked. The status dot became `Connected`. The toast was `Connected to AdventureWorks`.
4. New chat was created from the connection menu. The model menu listed 22 names from `opencode models --verbose`, including Beam Free and Grok 4.7. OpenCode Big and OpenCode Small were absent. The Fast switch and the Agent/Plan control were absent. Beam Free's reasoning menu listed `low`, `medium`, `high`, `xhigh`, `max`.
5. The composer sent `Reply with the single word pong.` The button changed to Stop, then back to Send. The transcript contained that prompt and the reply `pong`. Screenshot `opencode-pong-2026-10-23.png`.

## Side effect

`Chat` row 1: name `Reply with the si...`, provider `opencode`, session id `ses_e96f84a09ffeOlpF4Wxk8DH3Qd`.

One `opencode acp` process was running. Leaving the chat for Settings and coming back showed the same transcript, no toast, and still one `opencode acp` process.

`npx tsx scripts/check-opencode-catalog.ts` had already exited 0 and kept the variant key `not-a-cursor-effort`.
