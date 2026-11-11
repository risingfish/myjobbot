import { expect, test } from "vitest";
import type { FetchRow, RunRow } from "../src/db/monitoringReads.js";
import type { Snapshot } from "../src/metrics/snapshot.js";
import { metricValues } from "../src/metrics/values.js";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const NONE = { fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };

function run(id: string, startedAt: string, overrides: Partial<RunRow> = {}): RunRow {
    return { id, startedAt, aliveAt: startedAt, endedAt: new Date(Date.parse(startedAt) + 120_000).toISOString(), outcome: "finished", reason: null, incomplete: false, totals: { ...NONE, users: 1, usersFailed: 0, usersSkipped: 0, modelCalls: 4, promptTokens: 100, completionTokens: 10, searches: 3, searchFailures: 1 }, ...overrides };
}

function fetched(sourceId: number, outcome: string, at: string): FetchRow {
    return { sourceId, module: "greenhouse", at, outcome, reason: outcome === "failing" ? "not found" : null, pages: 1, jobs: 2, cost: 0 };
}

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
    return { now: NOW, runs: [], fetches: [], lookups: [], rescores: [], mails: [], jsearchUsed: 0, jsearchCap: 190, ...overrides };
}

function valueOf(values: ReturnType<typeof metricValues>, name: string, labels: Record<string, string> = {}): number | undefined {
    return values.find((value) => value.name === name && JSON.stringify(value.labels) === JSON.stringify(labels))?.value;
}

test("the latest run's times and whether it finished cleanly are given, and a missed run still shows with none recorded", () => {
    const failed = metricValues(snapshot({ runs: [run("b", "2026-11-10T09:00:00.000Z", { outcome: "failed" }), run("a", "2026-11-10T01:00:00.000Z")] }));
    expect([valueOf(failed, "myjobbot_last_run_started_timestamp_seconds"), valueOf(failed, "myjobbot_last_run_finished_timestamp_seconds"), valueOf(failed, "myjobbot_last_run_ok")]).toEqual([Date.parse("2026-11-10T09:00:00.000Z") / 1000, Date.parse("2026-11-10T09:02:00.000Z") / 1000, 0]);
    const none = metricValues(snapshot());
    expect([valueOf(none, "myjobbot_last_run_finished_timestamp_seconds"), valueOf(none, "myjobbot_last_run_ok"), valueOf(none, "myjobbot_runs_running")]).toEqual([0, 1, 0]);
});

test("runs, never-finished runs, durations, searches and model use are counted over the last day and the last 7 days", () => {
    const values = metricValues(snapshot({ runs: [run("c", "2026-11-10T11:58:00.000Z", { endedAt: null, outcome: null }), run("b", "2026-11-10T09:00:00.000Z", { endedAt: null, outcome: null }), run("a", "2026-11-05T01:00:00.000Z")] }));
    expect([valueOf(values, "myjobbot_runs_running"), valueOf(values, "myjobbot_runs", { status: "never_finished", window: "24h" }), valueOf(values, "myjobbot_runs", { status: "finished", window: "24h" }), valueOf(values, "myjobbot_runs", { status: "finished", window: "7d" })]).toEqual([1, 1, undefined, 1]);
    expect([valueOf(values, "myjobbot_run_duration_seconds_max", { window: "7d" }), valueOf(values, "myjobbot_company_searches", { outcome: "searched", window: "7d" }), valueOf(values, "myjobbot_model_calls", { worker: "run", window: "7d" })]).toEqual([120, 9, 12]);
});

test("each module's fetches, failures by reason, jobs and longest current failing streak are given", () => {
    const fetches = [fetched(1, "failing", "2026-11-10T10:00:00.000Z"), fetched(2, "ok", "2026-11-10T10:00:00.000Z"), fetched(1, "failing", "2026-11-09T10:00:00.000Z"), fetched(1, "failing", "2026-11-08T10:00:00.000Z"), fetched(2, "failing", "2026-11-08T10:00:00.000Z")];
    const values = metricValues(snapshot({ fetches }));
    expect([valueOf(values, "myjobbot_source_fetches", { module: "greenhouse", outcome: "failing", window: "24h" }), valueOf(values, "myjobbot_source_fetches", { module: "greenhouse", outcome: "failing", window: "7d" }), valueOf(values, "myjobbot_source_fetch_failures", { module: "greenhouse", reason: "not found", window: "7d" }), valueOf(values, "myjobbot_source_jobs", { module: "greenhouse", window: "24h" }), valueOf(values, "myjobbot_source_failing_streak_max", { module: "greenhouse" })]).toEqual([1, 4, 4, 4, 3]);
});

test("mail failures since the last sent mail, and the share of this month's JSearch budget used, are given", () => {
    const mails = [{ at: "2026-11-10T01:00:00.000Z", kind: "test", outcome: "sent", reason: null }, { at: "2026-11-10T02:00:00.000Z", kind: "sign_in_link", outcome: "failed", reason: "auth" }, { at: "2026-11-10T03:00:00.000Z", kind: "sign_in_link", outcome: "failed", reason: "auth" }];
    const values = metricValues(snapshot({ mails, jsearchUsed: 171 }));
    expect([valueOf(values, "myjobbot_mail_failure_streak"), valueOf(values, "myjobbot_mail_sends", { kind: "sign_in_link", outcome: "failed", window: "24h" }), valueOf(values, "myjobbot_jsearch_budget_used_ratio")]).toEqual([2, 2, 0.9]);
});
