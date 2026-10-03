#!/usr/bin/env bash
# Stop: run habit-hooks over the whole project. Block stopping while any
# finding remains, enforced or suggested, so rules hold even without a commit.
cd "$CLAUDE_PROJECT_DIR" || exit 0
out=$(habit-hooks 2>&1)
code=$?
if [ "$code" -ne 0 ] || grep -q '^── ' <<<"$out"; then
  printf 'habit-hooks is not clean (exit %s). Fix every item before finishing; never snooze without explicit user approval:\n\n%s\n' "$code" "$out" >&2
  exit 2
fi
exit 0
