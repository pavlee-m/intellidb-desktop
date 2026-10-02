# Settings — theme

## Sub-features

- Toggle light/dark; persists across restarts.

## How to get to it (user POV)

Home `/` → sidebar footer **Settings** → General tab. A card titled **Theme** shows the current theme and a `Switch to Dark` / `Switch to Light` button.

## Driving it with CDP

```bash
D=.cursor/skills/verify-intellidb/scripts/drive.mjs
node $D eval "window.history.pushState({}, '', '/settings/general'); window.dispatchEvent(new PopStateEvent('popstate'))"
node $D click 'main button.variant-secondary, main section button'   # or pick by text: see below
node $D eval "document.documentElement.classList.contains('dark')"
node $D screenshot .../evidence/settings-theme.png
```

To click the right button by text: `node $D eval "[...document.querySelectorAll('main button')].map(b => b.textContent)"` then use its index with `eval "...querySelectorAll('main button')[0].click()"` (plain click is fine for a plain `<button>`; Radix widgets are the ones needing real mouse events).

Proof of end state:

1. `document.documentElement.classList.contains('dark')` flips to `true`.
2. DB persisted: `node .cursor/skills/verify-intellidb/scripts/db-query.mjs "SELECT Value FROM Settings WHERE Key='theme';"` shows `dark`.

## Gotchas

- The `useEffect` that applies the theme runs **only on mount** with the store's value; a second toggle in the same session works, but the page heading "Current theme: …" can lag the store — trust the DB row and the `dark` class, not the label.
- Theme applies via Tailwind `dark` class on `<html>`; screenshots only differ visually if the page renders past the shell.
