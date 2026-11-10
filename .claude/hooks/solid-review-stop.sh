#!/usr/bin/env bash
# Stop: have the running session review, for SOLID, every src/ or web/ file
# that differs from main and hasn't been reviewed in its current content.
# The review is done in the session itself, so it costs no extra model call.
# Each file is asked about once per content: what was asked is recorded in the
# checkout's own git directory, so a later stop asks only about files edited
# since.
cd "$CLAUDE_PROJECT_DIR" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
reviewed="$(git rev-parse --git-dir)/solid-reviewed"
base=$(git merge-base main HEAD 2>/dev/null) || exit 0
touch "$reviewed"

pending=()
while IFS= read -r f; do
  case "$f" in src/*.ts|src/*.tsx|web/*.ts|web/*.tsx) ;; *) continue ;; esac
  [ -f "$f" ] || continue
  line="$(git hash-object -- "$f") $f"
  grep -qxF -- "$line" "$reviewed" && continue
  pending+=("$f")
  printf '%s\n' "$line" >>"$reviewed"
done < <({ git diff --name-only "$base" --; git ls-files --others --exclude-standard; } | sort -u)

[ "${#pending[@]}" -eq 0 ] && exit 0

{
  printf 'SOLID review before finishing (constitution Principle VI). These files changed since main and have not been reviewed in their current content:\n\n'
  printf '  %s\n' "${pending[@]}"
  printf '\nRead each one and check it against the SOLID rules in CLAUDE.md (Conventions): one responsibility per module, class and function; new variants through a registry or interface; implementations honour their contract; narrow interfaces; decisions take their dependencies. Fix every breach whose fix is a real improvement. Accept a breach whose only fix adds indirection or breaks a framework idiom (such as Next.js server actions), and tell the owner which you accepted and why. Then run npm run check. If nothing needs changing, say so in one line.\n'
} >&2
exit 2
