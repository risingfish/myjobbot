#!/usr/bin/env bash
# Start, check or stop a visible Brave window with remote debugging on 127.0.0.1, for the `brave`
# MCP server (Playwright attached over CDP). Uses its own profile: a running Brave ignores
# --remote-debugging-port, and Chromium refuses remote debugging on the default profile.
#
#   brave-debug.sh start [url]   open (or reuse) the debug window, optionally at url
#   brave-debug.sh status        exit 0 and print the endpoint if it is up
#   brave-debug.sh stop          close the debug window (your normal Brave is untouched)
set -euo pipefail

PORT="${BRAVE_DEBUG_PORT:-9222}"
PROFILE="${BRAVE_DEBUG_PROFILE:-$HOME/.cache/brave-debug-profile}"
BRAVE="${BRAVE_BIN:-$(command -v brave-browser || command -v brave || echo /opt/brave.com/brave/brave)}"

endpoint() { curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/json/version"; }

start() {
    if endpoint >/dev/null 2>&1; then
        echo "Brave debug window already running on 127.0.0.1:${PORT}"
    else
        mkdir -p "$PROFILE"
        nohup "$BRAVE" \
            --remote-debugging-port="$PORT" \
            --user-data-dir="$PROFILE" \
            --no-first-run \
            --no-default-browser-check \
            "${1:-about:blank}" >"$PROFILE/launch.log" 2>&1 &
        for _ in $(seq 1 30); do
            endpoint >/dev/null 2>&1 && break
            sleep 0.5
        done
        endpoint >/dev/null 2>&1 || { echo "Brave did not open port ${PORT}; see $PROFILE/launch.log" >&2; exit 1; }
        echo "Brave debug window started on 127.0.0.1:${PORT} (profile: $PROFILE)"
    fi
    endpoint
}

case "${1:-start}" in
    start) start "${2:-}" ;;
    status) endpoint || { echo "Brave debug window is not running" >&2; exit 1; } ;;
    stop) pkill -f -- "--user-data-dir=${PROFILE}" && echo "Brave debug window closed" || echo "Brave debug window was not running" ;;
    *) echo "usage: $0 start [url] | status | stop" >&2; exit 2 ;;
esac
