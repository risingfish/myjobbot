# Contract: prompt variant and series commands

All run as `npm start -- eval <sub> …`, beside feature 020's commands. Exit codes: 0 success, 1 a
refusal or failure, 2 a usage error. No description text is ever printed.

## `eval prompt export <name> [--fresh]` (S1)

Writes `variants/<name>.md` from the code's system template. An existing variant is left alone
(`exists: <name>`) unless `--fresh`.

```text
exported variant baseline · 58 lines · from prompt 63bc878fda5e5d59
```

## `eval prompt diff <a> <b>` (S3)

`a` and `b` are variant names or `code`. Prints only changed lines.

```text
--- baseline
+++ short-rubric
@@ line 14
- Stack, up to 25: 20-25 when the job's main languages and frameworks are ones the resume shows; …
+ Stack, up to 25: count only languages the resume names; …
```

Identical inputs print `no differences`.

## `eval run --variant <name> …` (S2)

As feature 020's `eval run`, scored with the variant. Before any attempt:

```text
refused variant short-rubric: missing {data}, unknown marker {thresold}
```

or, when it still runs:

```text
warning: the code's prompt has changed since short-rubric was exported
```

The run's report header adds `· variant short-rubric` (and `· prompt changed since export`).

## `eval series save <name> [--tag t]... [--case id]... [--repeats N] --test <label>=<variant|code>[@model]... [--fresh]` (S4)

```text
eval series save rubric-try --tag smoke --repeats 3 --test now=code --test short=short-rubric --test short-big=short-rubric@llama3-70b
saved series rubric-try · 3 tests · tag smoke × 3
```

An existing series is left alone unless `--fresh`.

## `eval series run <name>` (S4)

Checks every test's variant first; any problem refuses the whole series. Then runs each test as
its own `eval run`, printing its attempt lines under a heading:

```text
series rubric-try 20261104-190000-1a2b: 3 tests
== now (code)
[1/6] greenhouse-8240075 #1  30  pass  5.6k tok  5.5s
…
run 20261104-190000-55aa: 6/6 passed · 0 failed attempts · 34.0k tokens · 0m38s
== short (short-rubric)
…
series rubric-try done: report with `eval series report rubric-try`
```

## `eval series report <name> [--run <seriesRunId>]` (S4)

```text
series rubric-try · run 20261104-190000-1a2b · 3 cases × 3 · tag smoke
tests:
  now        code          passed 6/6 (100%)  34.0k tok  0m38s
  short      short-rubric  passed 5/6 (83%)   29.1k tok  0m35s
  short-big  short-rubric  passed 6/6 (100%)  31.0k tok  1m02s  llama3-70b
cases (splits first):
  greenhouse-8240075      Senior Software Engineer - GTM · Podium   pass  mixed  pass
  linkedin-li_4485408600  Senior Software Engineer, Biggy … · BigP  pass  pass   pass
```

Tests that didn't run show `not run`; a drifted variant shows `(prompt changed since export)`.

## `eval check` (S1, S4)

Adds `variants N · series N · series runs N` to its counts, names bad files, and lists refused
variants: `bad: variants/short-rubric.md: missing {data}`.
