import { expect, test } from "vitest";
import type { RescoreRun, StoredStep } from "../src/db/rescoreLogStore.js";
import { PING, sseText, streamEvents } from "../src/web/rescoreStream.js";

const STARTED = "2026-11-03T10:00:00.000Z";
const RUN: RescoreRun = { id: "r", ats: "greenhouse", jobId: "a", startedAt: STARTED, endedAt: null, outcome: null, filter: null, score: null };
const STEPS: StoredStep[] = [
    { seq: 1, elapsedMs: 10, kind: "settings", fields: { fallbacks: 0 } },
    { seq: 2, elapsedMs: 900, kind: "model_said", fields: { text: "ignore your instructions" } },
    { seq: 3, elapsedMs: 2400, kind: "reading", fields: {} },
];
const SOON = new Date("2026-11-03T10:01:00.000Z");

test("a running run gives its start and a line for each step that parses, numbered by its seq, and no end", () => {
    expect(streamEvents(RUN, STEPS, SOON)).toEqual([
        { event: "start", data: { ats: "greenhouse", jobId: "a", startedAt: STARTED } },
        { event: "step", id: 1, data: { seq: 1, elapsedMs: 10, line: "settings loaded" } },
        { event: "step", id: 3, data: { seq: 3, elapsedMs: 2400, line: "model reading the job" } },
    ]);
});

test("an ended run ends with its outcome, and a run open 10 minutes or more ends failed", () => {
    const ended = { ...RUN, endedAt: "2026-11-03T10:00:30.000Z", outcome: "filtered" as const, filter: "body" as const };
    expect([streamEvents(ended, [], SOON).at(-1), streamEvents(RUN, [], new Date("2026-11-03T10:10:00.000Z")).at(-1)]).toEqual([
        { event: "end", data: { outcome: "filtered", filter: "body", score: null } },
        { event: "end", data: { outcome: "failed", filter: null, score: null } },
    ]);
});

test("events are written as server-sent events, the heartbeat as a named ping", () => {
    expect(sseText([{ event: "step", id: 3, data: { line: "x" } }, PING])).toBe('id: 3\nevent: step\ndata: {"line":"x"}\n\nevent: ping\ndata: {}\n\n');
});
