import { expect, test } from "vitest";
import type { RescoreRun } from "../src/db/rescoreLogStore.js";
import type { VerdictView } from "../src/db/store.js";
import { historyRows } from "../src/web/history.js";

const NOW = new Date("2026-11-03T12:00:00.000Z");
const RESCORE = "aaaaaaaa-0000-4000-8000-000000000001";

function verdict(id: number, runId: string | null, at: string): VerdictView {
    return { id, run_id: runId, scored_at: at, score: 60, base_score: 40, bonus_score: 20, reasons: [], gaps: [], title: null, company: null, url: null, source: null };
}

function run(id: string, startedAt: string, end: Partial<RescoreRun> = {}): RescoreRun {
    return { id, ats: "greenhouse", jobId: "a", startedAt, endedAt: null, outcome: null, filter: null, score: null, ...end };
}

test("a verdict a re-score gave carries its log, and a scheduled run's verdict carries none", () => {
    const rows = historyRows([verdict(2, RESCORE, "2026-11-03T11:00:05.000Z"), verdict(1, "bbbbbbbb-run", "2026-11-02T09:00:00.000Z")], [run(RESCORE, "2026-11-03T11:00:00.000Z", { endedAt: "2026-11-03T11:00:06.000Z", outcome: "scored", score: 60 })], NOW);
    expect(rows.map((row) => [row.total, row.run, row.rescore])).toEqual([
        [60, "aaaaaaaa", { id: RESCORE, state: "scored", filter: null }],
        [60, "bbbbbbbb", null],
    ]);
});

test("a filtered, failed or running re-score is its own line, with no score, in time order among the verdicts", () => {
    const runs = [run("r3", "2026-11-03T11:58:00.000Z"), run("r2", "2026-11-03T10:00:00.000Z", { endedAt: "2026-11-03T10:00:01.000Z", outcome: "filtered", filter: "body" }), run("r1", "2026-11-01T10:00:00.000Z", { endedAt: "2026-11-01T10:00:09.000Z", outcome: "failed" })];
    const rows = historyRows([verdict(1, "scheduled", "2026-11-02T09:00:00.000Z")], runs, NOW);
    expect(rows.map((row) => [row.scoredAt, row.total, row.rescore?.state ?? null, row.rescore?.filter ?? null])).toEqual([
        ["2026-11-03 11:58", null, "running", null],
        ["2026-11-03 10:00", null, "filtered", "body"],
        ["2026-11-02 09:00", 60, null, null],
        ["2026-11-01 10:00", null, "failed", null],
    ]);
});

test("a re-score open 10 minutes or more counts as failed", () => {
    expect(historyRows([], [run("r1", "2026-11-03T11:50:00.000Z")], NOW)[0]?.rescore).toEqual({ id: "r1", state: "failed", filter: null });
});
