# Contract: Re-score log

## Start (server action, `web/lib/actions.ts`)

```ts
startRescore(ats: string, jobId: string): Promise<{ run: string } | { failed: true }>
```

- Checks the input with `jobRequest`; an invalid one gives `{ failed: true }` before any work. A
  re-score that can't start (its settings can't be read, the job is gone) records no run and gives
  `{ failed: true }`; the panel shows the existing failure note and no terminal.
- If the job has a run open (started < 10 minutes ago, not ended), returns that run's id and starts
  nothing (FR-014).
- Otherwise records the run (`RescoreLogStore.begin`), schedules the re-score with `after()`, and
  returns the new run's id at once. The re-score runs to the end whether or not anyone watches.
- `rescoreJob` (018) is removed; the panel refresh moves to the stream's `end` event.

## Follow (Route Handler, `web/app/api/rescores/[id]/route.ts`)

`GET /api/rescores/<run id>` → `200 text/event-stream`, or `404` for an unknown run.

| Event | `id` | `data` (JSON) |
|---|---|---|
| `start` | — | `{ ats, jobId, startedAt }` (the command line) |
| `step` | the step's `seq` | `{ seq, elapsedMs, line }`: `line` from `stepLine` only |
| `end` | — | `RescoreEnd` (`{ outcome, filter, score }`), then the stream closes |
| `ping` | — | `{}` every 5 s, a heartbeat the browser sees (comments are dropped by `EventSource`) |

- `[id]` must be a UUID, else `404`.
- On connect it sends `start`, every step after `Last-Event-ID` (all when absent), then polls every
  400 ms for new steps until the run ends, reads the steps once more, sends them and `end`, and
  closes.
- A run already ended sends `start`, all steps and `end` at once (a saved log, FR-012).
- A run open past 10 minutes ends with `{ outcome: "failed", filter: null, score: null }`.
- `line` is always produced by `stepLine` from a schema-checked row (FR-003); nothing else is sent.
- Headers `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`; the proxy's Host
  check applies as to every request.

## CLI

`npm start -- rescore <ats> <job_id>` records its run the same way, prints the command line and
each step's `consoleLine` to stdout as it happens, then the outcome. If the job has a run open, it
prints `alreadyRunningLine` (`rescore <ats> <job_id>: already running (<run id>)`) and exits 1
without re-scoring.

## Panel

- **Re-score** calls `startRescore`, then opens the terminal on the returned run, under the header.
  While the panel's run is open, the button reads "Re-scoring…" and is disabled.
- **Terminal** (`web/components/panel/RescoreTerminal.tsx`), its root marked `data-theme="dark"`
  so Pico's own dark colours apply in both page themes: title bar with the command
  (`myjobbot rescore <ats> <job_id>`) and a close (×) button; a dark monospace body (Pico's
  monospace font and colour variables) showing `$ myjobbot rescore <ats> <job_id>`, then each
  line as `[  2.4s] <line>`, a blinking cursor while running; `role="log"`, `aria-live="polite"`;
  scrolls to the newest line; no input. On `end` it shows the outcome line and stays until closed
  (FR-005). When the source is CLOSED or no event (`ping` included) has arrived for 15 s, it
  shows `live view lost: reopen the log from History` (FR-007).
- **On `end`** (`useRescoreTerminal`): the panel reloads its details; once they arrive, the list row
  is replaced from the reloaded `view.job` (as 018's `markRescored`); the fixed note
  (`rescoreNote(end)`) is shown as today.
- **Reopening**: when the panel opens a job whose History has a running re-score, its terminal
  opens at once and follows it.
- **History**: one list (FR-011). A score row whose run is a re-score has **Log**; a filtered,
  failed or running re-score has its own row (time, outcome) with **Log**. **Log** opens the
  terminal on that run, following it live if it is still running.
