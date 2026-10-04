#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=myjobbot:test
BAD_LLM=(-e LLM_BASE_URL=not-a-url -e LLM_MODEL=m -e LLM_API_KEY=k)

ok() { echo "ok - $1"; }
fail() { echo "not ok - $1" >&2; exit 1; }

expect_exit() {
  local want=$1 pattern=$2 name=$3; shift 3
  local out code=0
  out=$(docker run --rm "$@" 2>&1) || code=$?
  [ "$code" -eq "$want" ] || fail "$name: exit $code, wanted $want. Output: $out"
  grep -q -- "$pattern" <<<"$out" || fail "$name: output lacks '$pattern'. Output: $out"
  ok "$name"
}

data_dir() {
  local dir; dir=$(mktemp -d)
  chmod 777 "$dir"
  if [ "${1:-}" = "with-config" ]; then
    cp examples/config.json examples/resume.md "$dir/"
  fi
  echo "$dir"
}

docker build -q -t "$IMAGE" . >/dev/null || fail "image builds"
ok "image builds (supercronic checksum verified)"

[ "$(docker run --rm "$IMAGE" id -u)" = "1000" ] || fail "runs as uid 1000"
ok "runs as uid 1000"

expect_exit 2 "usage: myjobbot run" "cli prints usage without a command" "$IMAGE" node_modules/.bin/tsx src/cli.ts

empty=$(data_dir)
expect_exit 1 "missing /data/config.json" "run reports a missing config" -v "$empty:/data" "$IMAGE" run

configured=$(data_dir with-config)
expect_exit 1 "LLM_BASE_URL" "run reports a bad LLM URL readably" -v "$configured:/data" "${BAD_LLM[@]}" "$IMAGE" run

name="myjobbot-test-$$"
docker run -d --name "$name" -v "$configured:/data" "${BAD_LLM[@]}" -e SCHEDULE="*/5 * * * *" "$IMAGE" >/dev/null
sleep 3
logs=$(docker logs "$name" 2>&1)
running=$(docker inspect -f '{{.State.Running}}' "$name")
docker rm -f "$name" >/dev/null
[ "$running" = "true" ] || fail "schedule mode stays running. Logs: $logs"
grep -q "scheduling runs at '\*/5 \* \* \* \*'" <<<"$logs" || fail "schedule mode announces its schedule. Logs: $logs"
ok "schedule mode starts supercronic with SCHEDULE"

web="myjobbot-web-test-$$"
docker run -d --name "$web" -p 127.0.0.1:18082:8080 -v "$configured:/data" -e MYJOBBOT_HOST=0.0.0.0 \
  -e LLM_BASE_URL=http://127.0.0.1:9/v1 -e LLM_MODEL=m -e LLM_API_KEY=k "$IMAGE" serve >/dev/null
page=""
for _ in $(seq 1 20); do page=$(curl -s http://127.0.0.1:18082/recommended || true); [ -n "$page" ] && break; sleep 0.5; done
web_logs=$(docker logs "$web" 2>&1)
docker rm -f "$web" >/dev/null
grep -q "<h1>myjobbot</h1>" <<<"$page" || fail "serve mode answers on its port. Logs: $web_logs"
ok "serve mode answers on its port"

rm -rf "$empty" "$configured"
echo "all docker checks passed"
