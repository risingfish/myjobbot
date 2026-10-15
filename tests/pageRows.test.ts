import { expect, test } from "vitest";
import type { PageData } from "../src/web/api.js";
import { jobKey, withJobHidden, withMore, withoutJob, type RowsState } from "../web/lib/pageRows.js";
import { jobPage, jobRowView } from "./helpers/rowFixtures.js";

function jobs(from: number, count: number) {
    return Array.from({ length: count }, (_, index) => jobRowView({ jobId: String(from + index), title: `Job ${from + index}` }));
}

function state(data: PageData, version = 0): RowsState {
    return { data, error: null, moreError: null, version };
}

function titles(rows: RowsState): string[] {
    return rows.data?.kind === "jobs" ? rows.data.rows.map((row) => row.title) : [];
}

test("a failed load keeps the rows and records why", () => {
    const current = state(jobPage(jobs(0, 3), { total: 5, nextOffset: 3 }));
    const next = withMore(current, { data: null, error: "busy" }, 0);
    expect([titles(next), next.moreError, next.data?.nextOffset]).toEqual([["Job 0", "Job 1", "Job 2"], "busy", 3]);
});

test("rows that shift onto the next page are shown once, and the newer totals are kept", () => {
    const current = state(jobPage(jobs(0, 3), { total: 5, nextOffset: 3 }));
    const next = withMore(current, { data: jobPage(jobs(2, 3), { total: 6, nextOffset: null }), error: null }, 0);
    expect([titles(next), next.data?.total, next.data?.nextOffset]).toEqual([["Job 0", "Job 1", "Job 2", "Job 3", "Job 4"], 6, null]);
});

test("a page that started loading before a job was removed is dropped, so no job is skipped", () => {
    const loaded = state(jobPage(jobs(0, 3), { total: 5, nextOffset: 3 }));
    const afterHide = { ...loaded, data: withoutJob(jobKey(jobRowView({ jobId: "0" })))(loaded.data ?? jobPage([])), version: 1 };
    expect([afterHide.data?.nextOffset, afterHide.data?.total]).toEqual([2, 4]);
    expect(withMore(afterHide, { data: jobPage(jobs(4, 1), { total: 4, nextOffset: null }), error: null }, 0)).toBe(afterHide);
});

test("hiding on All jobs marks the row instead of removing it", () => {
    const data = jobPage(jobs(0, 2));
    const marked = withJobHidden(jobKey(jobRowView({ jobId: "1" })), true)(data);
    expect(marked.kind === "jobs" ? marked.rows.map((row) => row.hidden) : []).toEqual([false, true]);
});
