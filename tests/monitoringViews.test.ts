import { expect, test } from "vitest";
import type { FetchRow, PartRow, RunRow } from "../src/db/monitoringReads.js";
import { runDetailRows, runRows, runsPerDay } from "../src/web/monitoringRuns.js";
import { fetchesPerDay, moduleRows } from "../src/web/monitoringSources.js";
import { lookupRows, searchRow } from "../src/web/monitoringLookups.js";
import { mailRows, rescoreRows } from "../src/web/monitoringWork.js";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const NONE = { fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };
const TOTALS = { ...NONE, users: 2, usersFailed: 1, usersSkipped: 0, fetches: 5, fetchFailures: 1, jobsFound: 12, jobsScored: 9, modelCalls: 14 };

function run(id: string, overrides: Partial<RunRow> = {}): RunRow {
    return { id, startedAt: "2026-11-10T09:00:00.000Z", aliveAt: "2026-11-10T09:04:12.000Z", endedAt: "2026-11-10T09:04:12.000Z", outcome: "finished_with_errors", reason: null, incomplete: false, totals: TOTALS, ...overrides };
}

function part(userId: number, overrides: Partial<PartRow> = {}): PartRow {
    return { userId, partId: `p-${userId}`, startedAt: "2026-11-10T09:00:00.000Z", endedAt: "2026-11-10T09:02:00.000Z", outcome: "finished", reason: null, totals: { ...NONE, fetches: 2, jobsFound: 6, jobsScored: 4, modelCalls: 7, promptTokens: 900, completionTokens: 120 }, lookups: 3, ...overrides };
}

function fetched(sourceId: number, module: string, outcome: string, at: string): FetchRow {
    return { sourceId, module, at, outcome, reason: null, pages: 1, jobs: outcome === "ok" ? 4 : 0, cost: module === "jsearch" ? 1 : 0 };
}

test("each run shows its start, how long it took, how it stands, and its counts", () => {
    const rows = runRows([run("a"), run("b", { endedAt: null, outcome: null, aliveAt: "2026-11-10T11:50:00.000Z", incomplete: true })], NOW);
    expect(rows.map(({ id, duration, status, users, fetches, jobs, modelCalls, incomplete }) => ({ id, duration, status, users, fetches, jobs, modelCalls, incomplete }))).toEqual([
        { id: "a", duration: "4m 12s", status: "finished with errors", users: 2, fetches: "5 (1 failing)", jobs: "12 found, 9 scored", modelCalls: 14, incomplete: false },
        { id: "b", duration: "—", status: "never finished", users: 2, fetches: "5 (1 failing)", jobs: "12 found, 9 scored", modelCalls: 14, incomplete: true },
    ]);
    expect(rows[0]?.started).toMatch(/^2026-11-10 \d\d:\d\d$/);
});

test("a run's detail names each part by user id, and a part still running in a run that died is shown as running when it stopped", () => {
    const detail = runDetailRows({ run: run("b", { endedAt: null, outcome: null, aliveAt: "2026-11-10T09:10:00.000Z" }), parts: [part(1), part(2, { outcome: "running", endedAt: null, totals: NONE, lookups: 0 }), part(3, { outcome: "failed", reason: "database" })] }, NOW);
    expect(detail.parts.map(({ user, outcome, reason, lookups, model }) => [user, outcome, reason, lookups, model])).toEqual([
        ["User 1", "finished", null, 3, "7 calls, 1020 tokens"],
        ["User 2", "running when it stopped", null, 0, "0 calls, 0 tokens"],
        ["User 3", "failed", "database", 3, "7 calls, 1020 tokens"],
    ]);
    expect(detail.run.status).toBe("never finished");
});

test("each module shows its fetches by outcome, what it read, its top failure reasons and how many of its sources keep failing", () => {
    const fetches = [{ ...fetched(1, "greenhouse", "failing", "2026-11-10T09:00:00.000Z"), reason: "not found" }, fetched(2, "greenhouse", "ok", "2026-11-10T09:00:00.000Z"), { ...fetched(1, "greenhouse", "failing", "2026-11-09T09:00:00.000Z"), reason: "not found" }, { ...fetched(1, "greenhouse", "failing", "2026-11-08T09:00:00.000Z"), reason: "timeout" }, { ...fetched(3, "jsearch", "skipped", "2026-11-10T09:00:00.000Z"), reason: "budget used" }];
    expect(moduleRows(fetches)).toEqual([
        { module: "Greenhouse", fetches: 4, ok: 1, partial: 0, failing: 3, skipped: 0, pages: 4, jobs: 4, cost: 0, reasons: "not found (2), timeout (1)", failingSources: 1 },
        { module: "JSearch", fetches: 1, ok: 0, partial: 0, failing: 0, skipped: 1, pages: 1, jobs: 0, cost: 1, reasons: "", failingSources: 0 },
    ]);
});

test("the charts count runs by status and fetches by outcome for each day, oldest day first", () => {
    const runs = [run("a"), run("b", { startedAt: "2026-11-08T09:00:00.000Z", outcome: "finished" }), run("c", { startedAt: "2026-11-08T17:00:00.000Z", outcome: "finished" })];
    const series = runsPerDay(runs, NOW);
    expect(series.labels).toHaveLength(2);
    expect(series.sets).toEqual([{ name: "finished", values: [2, 0] }, { name: "finished with errors", values: [0, 1] }]);
    const fetchSeries = fetchesPerDay([{ ...fetched(1, "greenhouse", "failing", "2026-11-10T10:00:00.000Z"), reason: "x" }, fetched(1, "greenhouse", "ok", "2026-11-10T09:00:00.000Z")]);
    expect(fetchSeries.sets).toEqual([{ name: "ok", values: [1] }, { name: "failing", values: [1] }]);
    expect([runsPerDay([], NOW).labels, fetchesPerDay([]).sets]).toEqual([[], []]);
});

test("lookups are counted by how they ended and how their pages were read, and searches from the runs' totals", () => {
    const lookups = [{ at: "2026-11-10T09:00:00.000Z", step: "finish", outcome: "found", reason: null, pageSource: null }, { at: "2026-11-10T09:00:00.000Z", step: "finish", outcome: "failed", reason: "job_not_found", pageSource: null }, { at: "2026-11-10T09:00:00.000Z", step: "finish", outcome: "failed", reason: "job_not_found", pageSource: null }, { at: "2026-11-10T09:00:00.000Z", step: "open_job", outcome: "ok", reason: null, pageSource: "board" }, { at: "2026-11-10T09:00:00.000Z", step: "open_careers", outcome: "ok", reason: null, pageSource: "rendered" }];
    expect(lookupRows(lookups)).toEqual({ outcomes: [{ label: "not found: job_not_found", count: 2 }, { label: "found", count: 1 }], pages: [{ label: "board data", count: 1 }, { label: "browser", count: 1 }] });
    expect(searchRow([run("a", { totals: { ...TOTALS, searches: 4, searchFailures: 1 } }), run("b", { totals: { ...TOTALS, searches: 2 } })])).toEqual({ searched: 6, failed: 1 });
});

test("re-scores are counted by how they ended, one open too long as failed, with their typical and longest durations and model use", () => {
    const rescore = (startedAt: string, endedAt: string | null, outcome: "scored" | "failed" | null) => ({ startedAt, endedAt, outcome, filter: null, score: null, modelCalls: 2, promptTokens: 1000, completionTokens: 100 });
    const rows = rescoreRows([rescore("2026-11-10T09:00:00.000Z", "2026-11-10T09:00:40.000Z", "scored"), rescore("2026-11-10T09:00:00.000Z", "2026-11-10T09:02:00.000Z", "scored"), rescore("2026-11-10T09:00:00.000Z", "2026-11-10T09:00:20.000Z", "failed"), rescore("2026-11-10T09:00:00.000Z", null, null), rescore("2026-11-10T11:58:00.000Z", null, null)], NOW);
    expect(rows).toEqual({ outcomes: [{ label: "failed", count: 2 }, { label: "scored", count: 2 }, { label: "running", count: 1 }], typical: "40s", longest: "2m 0s", model: "10 calls, 5500 tokens" });
    expect(rescoreRows([], NOW)).toEqual({ outcomes: [], typical: "—", longest: "—", model: "0 calls, 0 tokens" });
});

test("mail is counted by kind and outcome, and failures by their fixed reason", () => {
    const mails = [{ at: "2026-11-10T09:00:00.000Z", kind: "sign_in_link", outcome: "sent", reason: null }, { at: "2026-11-10T09:01:00.000Z", kind: "sign_in_link", outcome: "failed", reason: "auth" }, { at: "2026-11-10T09:02:00.000Z", kind: "test", outcome: "failed", reason: "auth" }];
    expect(mailRows(mails)).toEqual({ sends: [{ label: "sign_in_link failed", count: 1 }, { label: "sign_in_link sent", count: 1 }, { label: "test failed", count: 1 }], failures: [{ label: "auth", count: 2 }] });
});
