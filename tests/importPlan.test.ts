import { expect, test } from "vitest";
import { batches, compareCounts, oversizedValues, sampleIndexes } from "../src/app/importPlan.js";

test("values longer than their column are listed by table and column", () => {
    const row = { ats: "greenhouse", job_id: "x".repeat(256), title: "t".repeat(600), url: "https://example.com", description: "d".repeat(20_000) };
    expect(oversizedValues("jobs", row)).toEqual(["jobs.job_id (256 > 255)", "jobs.title (600 > 500)"]);
    expect(oversizedValues("verdicts", { run_id: "r".repeat(65), scored_at: "2026-10-14T00:00:00.000Z" })).toEqual(["verdicts.run_id (65 > 64)"]);
    expect(oversizedValues("api_calls", { api: "jsearch", source: "S", called_at: "2026-10-14T00:00:00.000Z" })).toEqual([]);
});

test("length counts characters, so emoji and accents count once", () => {
    expect(oversizedValues("jobs", { title: "🚀".repeat(500) })).toEqual([]);
    expect(oversizedValues("jobs", { title: "é".repeat(501) })).toEqual(["jobs.title (501 > 500)"]);
});

test("rows are split into batches of a given size", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches([], 500)).toEqual([]);
});

test("sample indexes are spread evenly, repeatable, and never more than the rows", () => {
    expect(sampleIndexes(1000, 5)).toEqual([0, 200, 400, 600, 800]);
    expect(sampleIndexes(3, 50)).toEqual([0, 1, 2]);
    expect(sampleIndexes(0, 50)).toEqual([]);
});

test("count differences name each table that differs", () => {
    expect(compareCounts({ jobs: 754, verdicts: 720, api_calls: 45 }, { jobs: 754, verdicts: 719, api_calls: 45 })).toEqual(["verdicts: expected 720, found 719"]);
    expect(compareCounts({ jobs: 1 }, { jobs: 1 })).toEqual([]);
});
