import { expect, test } from "vitest";
import type { RunHistory } from "../src/db/runHistory.js";
import { RunRecorder, type RecorderTimers } from "../src/monitoring/recorder.js";
import { NO_TALLY } from "./helpers/monitoringContract.js";
import { MemoryRunHistory } from "./helpers/memoryMonitoring.js";

const START = Date.parse("2026-11-10T01:00:00.000Z");

function fakeTimers() {
    const ticks: Array<() => void> = [];
    let ms = START;
    const timers: RecorderTimers = {
        now: () => new Date(ms),
        every: (_ms, tick) => {
            ticks.push(tick);
            return () => void ticks.splice(0, ticks.length);
        },
    };
    return { timers, ticks, advance: (by: number) => void (ms += by) };
}

function recorder(history: RunHistory = new MemoryRunHistory()) {
    const clock = fakeTimers();
    const lines: string[] = [];
    return { clock, lines, history, recorder: new RunRecorder(history, "run-1", { timers: clock.timers, log: (line) => void lines.push(line) }) };
}

test("a run begins with a heartbeat that keeps it alive until it ends", async () => {
    const { clock, history, recorder: run } = recorder();
    await run.begin();
    clock.advance(60_000);
    clock.ticks.forEach((tick) => tick());
    await Promise.resolve();
    expect((history as MemoryRunHistory).runs[0]).toMatchObject({ aliveAt: "2026-11-10T01:01:00.000Z", endedAt: null });
    await run.end();
    expect(clock.ticks).toEqual([]);
});

test("each part is written as running when it starts and updated when it ends, and the run's totals and outcome come from its parts", async () => {
    const { history, recorder: run } = recorder();
    await run.begin();
    const started = await run.partStarted(1, "part-1");
    expect((history as MemoryRunHistory).parts).toMatchObject([{ userId: 1, partId: "part-1", outcome: "running" }]);
    await run.partEnded(started, { userId: 1, report: { status: "finished", reason: "done", steps: 3, runId: "part-1", summary: null } }, { ...NO_TALLY, fetches: 2, modelCalls: 5 });
    await run.partEnded(null, { userId: 2, skipped: "no resume" }, NO_TALLY);
    await run.partEnded(null, { userId: 3, failed: "boom with details", reason: "database" }, NO_TALLY);
    await run.end();
    expect((history as MemoryRunHistory).parts.map((part) => [part.userId, part.outcome, part.reason])).toEqual([[1, "finished", null], [2, "skipped", "no resume"], [3, "failed", "database"]]);
    expect((history as MemoryRunHistory).runs[0]).toMatchObject({ outcome: "finished_with_errors", incomplete: false, totals: { ...NO_TALLY, fetches: 2, modelCalls: 5, users: 3, usersFailed: 1, usersSkipped: 1 } });
});

test("a run whose parts all finished or were set aside finished, and a run that throws failed with a fixed reason", async () => {
    const { history, recorder: run } = recorder();
    await run.begin();
    await run.partEnded(null, { userId: 2, deleted: true }, NO_TALLY);
    await run.end();
    expect((history as MemoryRunHistory).runs[0]).toMatchObject({ outcome: "finished" });
    const failing = recorder();
    await failing.recorder.begin();
    await failing.recorder.fail(Object.assign(new Error("Access denied"), { sqlState: "28000" }));
    expect((failing.history as MemoryRunHistory).runs[0]).toMatchObject({ outcome: "failed", reason: "database" });
});

test("a write that fails is logged by a fixed line, never thrown, and the next write that succeeds marks the run incomplete", async () => {
    const history = new MemoryRunHistory();
    const { lines, recorder: run } = recorder(history);
    await run.begin();
    const partStarted = history.partStarted.bind(history);
    history.partStarted = () => Promise.reject(new Error("connection lost to 192.168.3.10"));
    await run.partStarted(1, "part-1");
    history.partStarted = partStarted;
    expect([lines, history.runs[0]?.incomplete]).toEqual([["run_history_failed"], false]);
    await run.end();
    expect(history.runs[0]).toMatchObject({ incomplete: true, outcome: "finished" });
});
