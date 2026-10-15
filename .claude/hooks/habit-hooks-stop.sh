#!/usr/bin/env bash
# Stop: run habit-hooks over the whole project. Block stopping while any
# finding remains, enforced or suggested, so rules hold even without a commit.
# While a sitting is in progress (.specify/sitting-in-progress exists, naming
# it), findings are reported instead of blocking: a sitting may span turns and
# must end clean (constitution Principle I); the pre-commit hook still blocks.
cd "$CLAUDE_PROJECT_DIR" || exit 0
out=$(habit-hooks 2>&1)
code=$?
if [ "$code" -eq 0 ] && ! grep -q '^── ' <<<"$out"; then
  exit 0
fi
marker=.specify/sitting-in-progress
if [ -f "$marker" ]; then
  sitting=$(head -n 1 "$marker")
  kinds=$(grep -c '^── ' <<<"$out")
  printf '{"systemMessage": "Sitting %s in progress: %s kind(s) of habit-hooks findings deferred to the end of the sitting."}\n' "${sitting:-?}" "$kinds"
  exit 0
fi
printf 'habit-hooks is not clean (exit %s). Fix every item before finishing; never snooze without explicit user approval:\n\n%s\n' "$code" "$out" >&2
exit 2
