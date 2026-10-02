#!/usr/bin/env bash
# Launch IntelliDB for verification (isolated scratch HOME + CDP port).
# Env overrides:
#   INTELLIDB_CDP_PORT       (default 9222)
#   INTELLIDB_SCRATCH_HOME   (default /tmp/intellidb-verify-home); set to "$HOME" to use real data
#   INTELLIDB_EVIDENCE_DIR   (default: <skill>/evidence)
#
# Why not `npm run start`? electron-forge does not forward CLI switches to Electron,
# and this machine's kernel blocks Chromium's namespace sandbox (the GPU process
# fails to launch and the app dies silently). So this script replicates forge's dev
# mode by hand: vite dev server for the renderer (the dev-built main.js loads
# http://localhost:5173) + the electron binary launched directly with
# --no-sandbox --disable-gpu. Those two flags are environment workarounds, not app
# requirements.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CDP_PORT="${INTELLIDB_CDP_PORT:-9222}"
SCRATCH_HOME="${INTELLIDB_SCRATCH_HOME:-/tmp/intellidb-verify-home}"
EVIDENCE_DIR="${INTELLIDB_EVIDENCE_DIR:-$SKILL_DIR/evidence}"
LOG=/tmp/intellidb-verify.log
VITE_LOG=/tmp/intellidb-verify-vite.log

cd "$REPO_ROOT"

fail() { echo "launch: $*" >&2; exit 1; }

# --- preconditions -----------------------------------------------------------
[ -x src/backend/sqlmcp.bin ] || fail "src/backend/sqlmcp.bin missing or not executable"

if curl -s -m 1 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then
  fail "CDP port $CDP_PORT already answering — another debugged instance? Run doctor.sh"
fi

if curl -s -m 1 "http://127.0.0.1:5173" >/dev/null 2>&1; then
  fail "port 5173 busy (vite dev server) — a real/user instance may be running. Run doctor.sh and ask the user."
fi

if ss -tln 2>/dev/null | grep -q ':8000 '; then
  fail "port 8000 busy (backend) — a real/user instance may be running. Run doctor.sh and ask the user."
fi

mkdir -p "$SCRATCH_HOME" "$EVIDENCE_DIR"

# Record pre-existing sqlmcp PIDs so cleanup only ever kills what we started.
pgrep -f 'sqlmcp\.bin' > /tmp/intellidb-verify.pre-sqlmcp 2>/dev/null || true

cleanup_on_fail() {
  echo "launch: failed — running cleanup" >&2
  "$SKILL_DIR/scripts/cleanup.sh" >/dev/null 2>&1 || true
}
trap cleanup_on_fail EXIT

# --- build check (forge produces .vite/ during start; reuse it) ---------------
if [ ! -f .vite/build/main.js ] || [ ! -f .vite/build/preload.js ]; then
  echo "launch: no .vite build output — running forge once to build (its app may die right after; that is expected here)"
  timeout 120 npm run start > "$LOG" 2>&1 || true
  [ -f .vite/build/main.js ] && [ -f .vite/build/preload.js ] || fail "forge did not produce .vite/build/{main,preload}.js"
fi

# --- backend warm-up ----------------------------------------------------------
# The app's health check (waitUntilBackendResponsive in src/main.ts) gives the
# backend only ~2.5s to boot. Cold, this 232MB binary takes ~4s to become
# responsive; warm (page cache), ~1.5s. So warm it once and stop it before the
# app spawns its own instance.
echo "launch: warming backend binary (page cache)"
./.vite/build/backend/sqlmcp.bin > "$VITE_LOG.warmup" 2>&1 &
WARM_PID=$!
WARMED=false
for i in $(seq 1 60); do
  if curl -s -m 1 "http://127.0.0.1:8000/connections" | grep -q 'connections'; then WARMED=true; break; fi
  sleep 1
done
kill -TERM "$WARM_PID" 2>/dev/null || true
for i in $(seq 1 5); do kill -0 "$WARM_PID" 2>/dev/null || break; sleep 1; done
kill -KILL "$WARM_PID" 2>/dev/null || true   # SIGTERM is not always honored promptly
for i in $(seq 1 10); do ss -tln 2>/dev/null | grep -q ':8000 ' || break; sleep 1; done
$WARMED || { tail -20 "$VITE_LOG.warmup"; fail "backend did not become responsive during warm-up"; }
echo "launch: backend warmed"

# --- renderer dev server ------------------------------------------------------
# Both long-lived processes are started via `setsid` inside a subshell: they get
# their own session, so they survive the calling shell/terminal exiting, and
# cleanup kills them by recorded/pattern PID — not by process group.
echo "launch: starting vite dev server on :5173"
( setsid env HOME="$SCRATCH_HOME" ./node_modules/.bin/vite --config vite.renderer.config.mts --port 5173 --strictPort > "$VITE_LOG" 2>&1 < /dev/null & )
for i in $(seq 1 60); do
  curl -s -m 1 "http://127.0.0.1:5173" >/dev/null 2>&1 && break
  sleep 1
done
curl -s -m 1 "http://127.0.0.1:5173" >/dev/null 2>&1 || { tail -20 "$VITE_LOG"; fail "vite dev server did not come up on :5173"; }
VITE_PID="$(pgrep -f 'renderer[.]config[.]mts' | head -1)"
echo "$VITE_PID" > /tmp/intellidb-verify-vite.pid
echo "launch: vite dev server up (pid $VITE_PID)"

# --- electron main process ----------------------------------------------------
echo "launch: starting electron (logs: $LOG)"
( setsid env HOME="$SCRATCH_HOME" ./node_modules/.bin/electron . \
  --remote-debugging-port="$CDP_PORT" --no-sandbox --disable-gpu > "$LOG" 2>&1 < /dev/null & )
ELECTRON_PID=""
for i in $(seq 1 30); do
  ELECTRON_PID="$(pgrep -f "remote[-]debugging-port=$CDP_PORT" | head -1)"
  [ -n "$ELECTRON_PID" ] && break
  sleep 1
done
[ -n "$ELECTRON_PID" ] || { tail -30 "$LOG" || true; fail "electron process not found after start"; }
echo "$ELECTRON_PID" > /tmp/intellidb-verify.pid
echo "launch: electron pid $ELECTRON_PID"

# --- readiness ---------------------------------------------------------------
# 1) CDP endpoint
for i in $(seq 1 60); do
  curl -s -m 1 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1 && break
  sleep 1
done
curl -s -m 1 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1 || { tail -30 "$LOG" || true; fail "CDP did not come up on port $CDP_PORT"; }
echo "launch: CDP up on port $CDP_PORT"

# 2) Renderer mounted
READY=false
for i in $(seq 1 60); do
  if node "$SKILL_DIR/scripts/drive.mjs" eval "document.querySelector('#root') !== null && document.querySelector('#root').children.length > 0" 2>/dev/null | grep -qi true; then
    READY=true; break
  fi
  sleep 1
done
$READY || { tail -30 "$LOG" || true; fail "renderer never mounted"; }
echo "launch: renderer mounted"

# 3) Backend responsive (app quits itself if not)
for i in $(seq 1 20); do
  if curl -s -m 2 "http://127.0.0.1:8000/connections" | grep -q 'connections'; then break; fi
  sleep 1
done
curl -s -m 2 "http://127.0.0.1:8000/connections" | grep -q 'connections' || { tail -30 "$LOG" || true; fail "backend not responsive on :8000"; }
echo "launch: backend up on :8000"

trap - EXIT
echo "launch: READY — scratch HOME=$SCRATCH_HOME, evidence dir=$EVIDENCE_DIR"
echo "launch: teardown with: $SKILL_DIR/scripts/cleanup.sh"
