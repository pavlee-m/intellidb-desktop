#!/usr/bin/env bash
# Read-only health check: is this IntelliDB instance worth driving?
set -u
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
CDP_PORT="${INTELLIDB_CDP_PORT:-9222}"
ok=0
status() { printf '%-28s %s\n' "$1" "$2"; }

# 1. Backend binary
if [ -x "$REPO_ROOT/src/backend/sqlmcp.bin" ]; then
  status "backend binary:" "ok ($(du -h "$REPO_ROOT/src/backend/sqlmcp.bin" | cut -f1))"
else
  status "backend binary:" "MISSING — app will quit at startup"; ok=1
fi

# 2. Port 8000 / sqlmcp
if ss -tlnp 2>/dev/null | grep -q ':8000 '; then
  backend_pid="$(ss -tlnp 2>/dev/null | grep ':8000 ' | grep -oP 'pid=\K[0-9]+' | head -1)"
  if [ -n "${backend_pid:-}" ] && tr '\0' ' ' < "/proc/$backend_pid/cmdline" 2>/dev/null | grep -q 'sqlmcp\.bin'; then
    status "port 8000:" "owned by sqlmcp.bin (pid $backend_pid)"
  else
    status "port 8000:" "owned by a NON-sqlmcp process (pid ${backend_pid:-?}) — app backend will fail to bind"; ok=1
  fi
else
  status "port 8000:" "nothing listening (backend not running)"
fi

# 3. CDP
if curl -s -m 1 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then
  status "CDP :$CDP_PORT:" "answering — instance is drivable"
else
  status "CDP :$CDP_PORT:" "not answering (not launched via launch.sh, or dead)"
fi

# 4. Electron + vite dev server from this repo (matched by our launch-time flags)
if pgrep -f "remote[-]debugging-port=$CDP_PORT" >/dev/null 2>&1; then
  status "electron (ours):" "running (pid $(pgrep -f "remote[-]debugging-port=$CDP_PORT" | head -1))"
else
  status "electron (ours):" "not running — launch.sh not used or app died"
fi
if pgrep -f 'renderer[.]config[.]mts' >/dev/null 2>&1; then
  status "vite dev server:" "running (pid $(pgrep -f 'renderer[.]config[.]mts' | head -1))"
else
  status "vite dev server:" "not running (renderer will fail to load without it)"
fi

exit $ok
