# Settings — integrations (opencode / Cursor CLI)

## Sub-features

- Enable/disable the opencode integration; set its binary path.
- Enable/disable the Cursor CLI integration; set its binary path.

## How to get to it (user POV)

Home `/` → sidebar footer **Settings** → **Integrations** tab. Two cards (Opencode, Cursor CLI), each with an **Enable** checkbox and a binary-path input (disabled until enabled).

## Driving it with CDP

```bash
D=.cursor/skills/verify-intellidb/scripts/drive.mjs
node $D eval "window.history.pushState({}, '', '/settings/integrations'); window.dispatchEvent(new PopStateEvent('popstate'))"
node $D fill '#opencode-binary' '/usr/local/bin/opencode'
node $D eval "document.querySelector('#opencode-binary').blur()"      # value saves on blur
```

The Enable checkboxes are plain `<input type="checkbox">` inside a `<label>`; `click` on the checkbox works.

Proof of end state:

1. DB rows: `node .cursor/skills/verify-intellidb/scripts/db-query.mjs "SELECT Key, Value FROM Settings WHERE Key LIKE 'opencode%' OR Key LIKE 'cursor%';"` — `opencode_integration_enabled` = `true` and `opencode_binary` = the path typed.
2. UI state: checkbox `checked` property true; input no longer `disabled`.
3. Defaults: a fresh scratch DB has `opencode_integration_enabled=false`, `opencode_binary=opencode`, `cursor_cli_integration_enabled=false`, `cursor_cli_binary=cursor-agent` (seeded in `src/main.ts`).

## Gotchas

- Binary path saves **on blur** only, and empty input silently resets to `opencode`/`cursor-agent` on blur.
- `getSettings()` tolerates absent rows but `DBManager.getSettings` defaults the integration flags to `true` when rows are missing — seeded rows always exist on a DB created by this app version, so only trust this on fresh DBs.
- These settings currently gate nothing user-visible (the chat feature is scaffolding); the proof is persistence, not behavior.
