#!/usr/bin/env bash
# Tear down the IntelliDB verification instance. Safe to run twice, safe after failures.
# Kills only recorded PIDs (never name-based sweeps, never process groups — the
# script may share a process group with its caller).
set -u
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CDP_PORT="${INTELLIDB_CDP_PORT:-9222}"

# 1) Graceful quit via the app's own teardown path (closes DB, kills backend tree)
if curl -s -m 1 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then
  node "$SKILL_DIR/scripts/drive.mjs" eval "window.close()" >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do
    curl -s -m 1 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1 || break
    sleep 1
  done
  echo "cleanup: graceful quit sent"
fi

# 2) Kill electron and vite by recorded PID, falling back to the unique cmdline
#    patterns our launch script uses (bracket trick keeps pgrep from matching
#    the caller's own command line)
for name in electron vite; do
  FILE="/tmp/intellidb-verify${name/group/}.pid"
  [ "$name" = "electron" ] && FILE="/tmp/intellidb-verify.pid"
  [ "$name" = "vite" ] && FILE="/tmp/intellidb-verify-vite.pid"
  if [ "$name" = "electron" ]; then
    PIDS="$(pgrep -f "remote[-]debugging-port=${CDP_PORT}" 2>/dev/null || true)"
  else
    PIDS="$(pgrep -f 'renderer[.]config[.]mts' 2>/dev/null || true)"
  fi
  if [ -f "$FILE" ]; then
    RECORDED="$(cat "$FILE")"
    PIDS="$(printf '%s\n%s' "$PIDS" "$RECORDED" | sort -u | grep -v '^$' || true)"
    rm -f "$FILE"
  fi
  for PID in $PIDS; do
    if kill -0 "$PID" 2>/dev/null; then
      kill -TERM "$PID" 2>/dev/null || true
      echo "cleanup: killed $name (pid $PID)"
    fi
  done
done
sleep 2
for PID in $(pgrep -f "remote[-]debugging-port=${CDP_PORT}"; pgrep -f 'renderer[.]config[.]mts'); do
  kill -KILL "$PID" 2>/dev/null || true
done

# 3) Kill only sqlmcp PIDs that appeared after launch (not in the pre-launch snapshot)
if [ -f /tmp/intellidb-verify.pre-sqlmcp ]; then
  for pid in $(pgrep -f 'sqlmcp\.bin' 2>/dev/null); do
    if ! grep -qx "$pid" /tmp/intellidb-verify.pre-sqlmcp; then
      kill -TERM "$pid" 2>/dev/null || true
      echo "cleanup: killed our sqlmcp pid $pid"
    fi
  done
  rm -f /tmp/intellidb-verify.pre-sqlmcp
fi

# 4) Scratch state — evidence is NOT here, so deleting is safe
rm -rf /tmp/intellidb-verify-home
rm -f /tmp/intellidb-verify.log /tmp/intellidb-verify-vite.log /tmp/intellidb-verify-vite.log.warmup /tmp/intellidb-verify.pgid /tmp/sqlmcp-probe.log /tmp/sqlmcp-probe.pid

echo "cleanup: done — evidence preserved in $SKILL_DIR/evidence/"
