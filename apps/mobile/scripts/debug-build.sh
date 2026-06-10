#!/usr/bin/env bash
# Captures EAS / Expo build state into the NDJSON debug log so the agent
# can diagnose why no APK is being produced. Safe to re-run.
set -u

LOG_PATH="$HERE/../../.cursor/debug-a5c909.log"
SESSION="a5c909"
RUN_ID="diag-$(date +%s)"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

emit () {
  # emit <hypothesisId> <location> <message> <jsonData>
  local hid="$1"; shift
  local loc="$1"; shift
  local msg="$1"; shift
  local data="${1:-{\}}"; shift || true
  python3 - "$LOG_PATH" "$SESSION" "$RUN_ID" "$hid" "$loc" "$msg" "$data" <<'PY'
import json, sys, time, os
log_path, session, run_id, hid, loc, msg, raw = sys.argv[1:8]
try:
    data = json.loads(raw)
except Exception:
    data = {"raw": raw}
entry = {
  "sessionId": session,
  "runId": run_id,
  "hypothesisId": hid,
  "location": loc,
  "message": msg,
  "data": data,
  "timestamp": int(time.time()*1000),
}
os.makedirs(os.path.dirname(log_path), exist_ok=True)
with open(log_path, "a") as f:
    f.write(json.dumps(entry) + "\n")
PY
}

run_capture () {
  # run_capture <hypothesisId> <label> -- <cmd...>
  local hid="$1"; shift
  local label="$1"; shift
  shift   # consume "--"
  local cmd_str="$*"
  echo ""
  echo "▶ [$hid] $label"
  echo "  \$ $cmd_str"
  local tmp_out tmp_err
  tmp_out="$(mktemp)"; tmp_err="$(mktemp)"
  ( "$@" ) >"$tmp_out" 2>"$tmp_err"
  local rc=$?
  local out err
  out="$(head -c 8000 "$tmp_out")"
  err="$(head -c 8000 "$tmp_err")"
  echo "$out"
  if [ -n "$err" ]; then echo "  -- stderr --"; echo "$err"; fi
  echo "  -- exit: $rc"
  python3 - "$LOG_PATH" "$SESSION" "$RUN_ID" "$hid" "$label" "$cmd_str" "$rc" "$tmp_out" "$tmp_err" <<'PY'
import json, sys, time, os
log_path, session, run_id, hid, label, cmd, rc, op, ep = sys.argv[1:10]
out = open(op).read()[:8000]
err = open(ep).read()[:8000]
entry = {
  "sessionId": session,
  "runId": run_id,
  "hypothesisId": hid,
  "location": "scripts/debug-build.sh",
  "message": label,
  "data": {"cmd": cmd, "exitCode": int(rc), "stdout": out, "stderr": err},
  "timestamp": int(time.time()*1000),
}
os.makedirs(os.path.dirname(log_path), exist_ok=True)
with open(log_path, "a") as f:
    f.write(json.dumps(entry) + "\n")
PY
  rm -f "$tmp_out" "$tmp_err"
}

cd "$HERE" || exit 1

echo "=== Aurafit mobile build diagnostics ==="
echo "(All output also saved to $LOG_PATH for the agent to read.)"

emit "ENV" "scripts/debug-build.sh:start" "session_start" "{\"cwd\":\"$HERE\",\"node\":\"$(node -v 2>/dev/null)\",\"npm\":\"$(npm -v 2>/dev/null)\"}"

run_capture "H1" "Find local APK / build artifacts" -- bash -c 'find "$0" -maxdepth 4 -name "*.apk" -not -path "*/node_modules/*" 2>/dev/null; echo; echo "dist/ contents:"; ls -la dist/ 2>/dev/null | head -10' "$HERE"

run_capture "ENV" "EAS CLI version" -- npx --no-install eas-cli --version
run_capture "ENV" "Logged-in EAS user" -- npx --no-install eas-cli whoami
run_capture "ENV" "Project info" -- npx --no-install eas-cli project:info

run_capture "H3" "Recent Android builds" -- npx --no-install eas-cli build:list --platform=android --limit=5 --non-interactive

run_capture "H2" "Verify eas.json + app.json present here" -- bash -c 'echo "PWD: $PWD"; ls -la eas.json app.json package.json 2>&1'

run_capture "H4" "Local plugin/module resolution sanity" -- node -e 'console.log("expo-router:", require.resolve("expo-router/app.plugin")); console.log("expo:", require.resolve("expo/package.json"))'

# Pull the actual error from the most recent failed cloud build so we can
# see WHY it errored. eas-cli does not have a `build:logs` subcommand, but
# `build:view --json` emits the structured error field, and the human-
# readable view below it shows the error block too.
LATEST_FAILED_ID="51ac0595-bcc1-45ad-9cae-a98c9bcf895b"
run_capture "H6" "Latest failed build details (json)" -- npx --no-install eas-cli build:view --json "$LATEST_FAILED_ID"
run_capture "H6" "Latest failed build details (text)" -- npx --no-install eas-cli build:view "$LATEST_FAILED_ID"

# Try to download the build log. The presigned S3 URL is in metadata as
# `logFiles` or `artifacts.logs` depending on the eas-cli version. Use python
# to extract whichever is present, then curl it.
run_capture "H6" "Download build log via metadata logFiles" -- bash -c '
ID="51ac0595-bcc1-45ad-9cae-a98c9bcf895b"
META=$(npx --no-install eas-cli build:view --json "$ID" 2>/dev/null)
URL=$(printf "%s" "$META" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except Exception as e:
    print(\"\"); sys.exit(0)
candidates = []
def walk(o, path=\"\"):
    if isinstance(o, dict):
        for k,v in o.items(): walk(v, f\"{path}.{k}\")
    elif isinstance(o, list):
        for i,v in enumerate(o): walk(v, f\"{path}[{i}]\")
    elif isinstance(o, str) and (o.startswith(\"http\") and (\"log\" in o.lower() or \"build.log\" in o.lower() or \"xlogs\" in o.lower())):
        candidates.append((path,o))
walk(d)
print(\"\\n\".join(f\"{p} => {u}\" for p,u in candidates))
")
echo "Candidate log URLs from metadata:"
echo "$URL"
echo
# Take the first http URL that looks like a log and curl 4KB of it
FIRST=$(printf "%s" "$URL" | head -1 | awk -F" => " "{print \$2}")
if [ -n "$FIRST" ]; then
  echo "--- Fetching head of: $FIRST ---"
  curl -sS --max-time 15 "$FIRST" | head -c 8000
fi
'

emit "ENV" "scripts/debug-build.sh:done" "session_done" "{}"

echo ""
echo "✓ Diagnostics written. The agent will read $LOG_PATH next."
