# Model picker, 2026-10-10

Scratch home `/tmp/intellidb-verify-home`. AdventureWorks was connected. Both integrations were enabled from Settings.

Observed in the composer of a new chat:

- Model menu listed OpenCode Big and OpenCode Small.
- OpenCode Small showed reasoning `low` and `high`, and no Fast control.
- OpenCode Big showed reasoning `low`, `medium`, and `high`, and a Fast switch.
- Send on OpenCode Big left the draft in the box and toasted `OpenCode is not connected yet`.
- `Chat` has a `Provider` column (`TEXT NOT NULL DEFAULT ''`). No row was inserted, so the chat stayed unlocked.

`models:cursor` failed in this window. The log says `cursor-agent models` returned authentication required. This process uses the scratch home, so the Cursor CLI login from the normal home is not visible. Cursor names did not appear in the menu.
