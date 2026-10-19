# Keyring backend detection — 2026-10-19

Feature: on Linux, `src/main.ts` probes the session bus for a supported keyring
backend (`src/lib/linuxKeyringBackend.ts`, ordered registry: gnome-libsecret,
kwallet6, kwallet5, kwallet) and passes the first hit to Chromium as the
`password-store` switch. If none is found, a native error box says the
application cannot start and the app exits 1.

## Happy path (backend present)

- `dbus-send --session --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.ListNames`
  shows `org.freedesktop.secrets` on this machine; no kwallet names. The
  detector must return `gnome-libsecret` (same value the code previously
  hardcoded, so behavior is preserved).
- `launch.sh` (forge build with the change, scratch HOME, CDP drive): renderer
  mounted, backend up on :8000, app log shows normal ready flow
  (`{ connections: [] }`).
- Screenshot: `keyring-backend-happy-2026-10-19.png` (Home view).

## No-backend path

- Stubbed `dbus-send` on `PATH` (`exit 1`) so the probe finds nothing.
- Direct electron launch (no vite/backend needed; the app quits before ready):
  native error box shown, stderr carries the box title and message
  ("No keyring backend found" / "Connection credentials cannot be stored
  securely, so the application cannot start."), process exits with code 1.
- First run with `app.quit()` crashed with `SIGABRT` (napi_throw) and left an
  empty `config.db`: `ready` fired during the modal dialog's nested event loop
  and the `before-quit` handler killed an in-flight `initDatabase`. Fixed by
  using `app.exit(1)`, which skips `before-quit` (nothing is open yet at boot).
  Re-test: clean exit code 1, no crash.

## Notes / harness flakes observed (pre-existing, not this feature)

- `launch.sh` backend health check (5 x 500 ms) intermittently fails right
  after warm-up; a retry succeeds once the page cache is hot. Seen twice.
- The forge build step inside `launch.sh` runs `npm run start` with the
  caller's real `HOME`, so forge's throwaway app instance touches the real
  `~/.intellidb` and may briefly hold port 8000. Real DB verified intact
  afterwards (Settings, Connection, Message, Chat all present).