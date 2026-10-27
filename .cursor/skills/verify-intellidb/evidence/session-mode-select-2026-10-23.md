# Session mode select (2026-10-23)

Scratch home launch on CDP port 9223. Connection `verify-aw` to localhost AdventureWorks2025. Cursor CLI enabled with `/home/pavle/.local/bin/cursor-agent`.

The composer Mode select offered Agent and Plan. It started on Agent. Picking Plan updated the trigger to Plan. Picking Agent, then Plan again, updated the trigger each time. Changing the model from Auto to Composer 2.5 left the mode on Plan.

Sent "Reply with the single word pong. Do not edit files." with Composer 2.5 and Plan. The transcript shows the user line and the reply `pong`. The mode trigger stayed Plan. No error toast. Chat row in the scratch DB: ID 1, provider `cursor`.

Screenshot: `session-mode-composer-plan-2026-10-23.png`.
