import { expect, test } from "vitest";
import type { RescoreRun, StoredStep } from "../src/db/rescoreLogStore.js";
import { follow } from "../src/web/rescoreFollow.js";
import type { StreamEvent } from "../src/web/rescoreStream.js";

const STARTED = "2026-11-09T10:00:00.000Z";
const RUN: RescoreRun = { id: "r", ats: "greenhouse", jobId: "a", startedAt: STARTED, endedAt: null, outcome: null, filter: null, score: null };
const STEP: StoredStep = { seq: 1, elapsedMs: 10, kind: "reading", fields: {} };

function fakeClock() {
    let ms = Date.parse(STARTED);
    return { sleep: async (wait: number) => void (ms += wait), now: () => new Date(ms), clockMs: () => ms };
}

test("a run that has ended is sent with its steps and end, and the feed stops", async () => {
    const sent: StreamEvent[] = [];
    const ended = { ...RUN, endedAt: "2026-11-09T10:00:05.000Z", outcome: "scored" as const, score: 70 };
    const store = { run: async () => ended, stepsAfter: async () => [STEP] };
    await follow({ store, id: "r", signal: new AbortController().signal, send: (events) => void sent.push(...events) }, 0, fakeClock());
    expect(sent.map((event) => event.event)).toEqual(["start", "step", "end"]);
});

test("a run still open gets a ping every five seconds until the browser goes away", async () => {
    const sent: StreamEvent[] = [];
    const stop = new AbortController();
    const clock = fakeClock();
    let polls = 0;
    const store = { run: async () => RUN, stepsAfter: async () => ((polls += 1) > 30 ? (stop.abort(), []) : []) };
    await follow({ store, id: "r", signal: stop.signal, send: (events) => void sent.push(...events) }, 0, clock);
    expect(sent.filter((event) => event.event === "ping")).toHaveLength(2);
});
