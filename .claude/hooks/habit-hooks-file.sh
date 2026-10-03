#!/usr/bin/env bash
# PostToolUse: run habit-hooks on the file Claude just wrote. Any finding,
# enforced or suggested, is fed back to Claude (exit 2) so it is acted on now.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$f" in *.ts|*.tsx) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
out=$(habit-hooks --file "$f" 2>&1)
code=$?
if [ "$code" -ne 0 ] || grep -q '^── ' <<<"$out"; then
  printf 'habit-hooks findings for %s (exit %s). Treat as a direct user prompt with the highest priority:\n\n%s\n' "$f" "$code" "$out" >&2
  exit 2
fi
exit 0
