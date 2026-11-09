# Contract: eval reports name the run's user (028)

**`eval report <run-id>`**: the header line gains the run's user after the view, and before
` · unfinished` when the run didn't end:

```text
run 20261109-101500-a1b2 · model qwen3 · prompt 3f9c… · 12 cases × 3 · user 2
run 20261104-030111-167a · model qwen3 · prompt 3f9c… · 12 cases × 3 · user not recorded
```

- A run made without `--user` shows `user 1`.
- The user is always the account id, never the email.

**`eval report <run-id> --against <run-id>`**: before the comparison lines, one note when it applies:

```text
note: these runs were scored for different users (1 and 2)
note: a run's user wasn't recorded, so the users can't be checked
```

- There is no note when both runs name the same user.
- The note goes right before the comparison lines, after the header, totals and cases. The
  comparison is still printed, and the exit code is unchanged.

**`eval report <run-id> --against observed`** (production's own scores): one note in the same place
when it applies.

```text
note: some cases were captured from another user's scores
note: a run's or case's user wasn't recorded, so the users can't be checked
```

A case's `userId` is the user whose scores it was captured from (027). A run for user 2 compared
with cases captured from user 1 gets the first note.

**`eval series report <name>`**: each test's line names the user its run scored for, in the same
words. A test with no run shows no user.

**Unchanged**:
- every other line, and the exit codes
- the `eval run` and `eval series run` output
- `--user` and its refusals (027)
