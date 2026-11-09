import { expect, test } from "vitest";
import type { TestStores } from "./helpers/memoryStore.js";
import type { BeginResult, RescoreEnd } from "../src/db/rescoreLogStore.js";
import type { JobStore } from "../src/db/jobStore.js";
import type { JobViews } from "../src/db/jobViews.js";
import type { RescoreDeps } from "../src/rescore/rescore.js";
import type { JobRowView, PageData } from "../src/web/api.js";
import { loadDetailsFor, loadRows, setAppliedFor, setHiddenFor, startRescoreFor } from "../web/lib/rows.js";
import { testAppSettings } from "./helpers/config.js";
import { memoryTrace } from "./helpers/trace.js";
import { seededStores } from "./helpers/views.js";

const config = testAppSettings();
const settings = { config, sourceNames: ["Stripe", "Gmail alerts"] };
const JOB_A = { ats: "greenhouse", jobId: "a" };

function jobRows(data: PageData): JobRowView[] {
    return data.kind === "jobs" ? data.rows : [];
}

async function seededViews(entries: Parameters<typeof seededStores>[0]): Promise<JobViews> {
    return (await seededStores(entries)).jobViews;
}

test("loadRows returns the requested slice of a page", async () => {
    const views = await seededViews(Array.from({ length: 150 }, (_, index) => ({ id: String(index).padStart(3, "0") })));
    const data = await loadRows(views, settings, { name: "jobs", offset: 100 });
    expect([data.rows.length, data.nextOffset, data.total]).toEqual([50, null, 150]);
});

test("loadRows refuses an unknown page or a bad offset", async () => {
    const views = await seededViews([{ id: "a" }]);
    const requests = [
        { name: "nope", offset: 0 },
        { name: "jobs", offset: -5 },
        { name: "jobs", offset: 1.5 },
        { name: "jobs", offset: 2_000_000 },
        { name: "jobs", offset: "abc" },
    ];
    for (const request of requests) await expect(loadRows(views, settings, request)).rejects.toThrow("Invalid page request");
});

test("loadRows passes on the reason a load failed", async () => {
    const broken = { countAllJobs: () => Promise.reject(new Error("broken <db>")) } as unknown as JobViews;
    await expect(loadRows(broken, settings, { name: "jobs", offset: 0 })).rejects.toThrow("broken <db>");
});

test("hiding a job removes it from recommended and marks it in all jobs, and unhiding brings it back", async () => {
    const views = await seededViews([{ id: "a", score: 90 }]);
    expect(await setHiddenFor(views, { ...JOB_A, hidden: true })).toEqual({ ok: true });
    expect((await loadRows(views, settings, { name: "recommended", offset: 0 })).rows).toEqual([]);
    expect(jobRows(await loadRows(views, settings, { name: "jobs", offset: 0 })).map((job) => [job.jobId, job.hidden])).toEqual([["a", true]]);
    await setHiddenFor(views, { ...JOB_A, hidden: false });
    expect(jobRows(await loadRows(views, settings, { name: "recommended", offset: 0 })).map((job) => job.jobId)).toEqual(["a"]);
});

test("hiding an unknown job reports that there is no such job", async () => {
    const views = await seededViews([{ id: "a" }]);
    expect(await setHiddenFor(views, { ats: "greenhouse", jobId: "missing", hidden: true })).toEqual({ ok: false, error: "No such job." });
});

test("a malformed hide request is refused and changes nothing", async () => {
    const views = await seededViews([{ id: "a", score: 90 }]);
    for (const change of [{ ...JOB_A, hidden: "yes" }, { ...JOB_A, ats: "", hidden: true }, null]) {
        await expect(setHiddenFor(views, change)).rejects.toThrow("Invalid hide request");
    }
    expect(jobRows(await loadRows(views, settings, { name: "recommended", offset: 0 })).map((job) => job.jobId)).toEqual(["a"]);
});

test("a job whose text tried to escape the data markers is marked on its row", async () => {
    const stores = await seededStores([{ id: "a" }, { id: "b" }]);
    await stores.postings.flagInjection("a", "2026-10-02T00:00:00.000Z");
    const data = await loadRows(stores.jobViews, settings, { name: "jobs", offset: 0 });
    expect(Object.fromEntries(jobRows(data).map((row) => [row.jobId, row.injection]))).toEqual({ a: true, b: false });
});

function detailStores(stores: TestStores) {
    return { views: stores.jobViews, rescoreLog: stores.rescoreLog };
}

test("loadDetailsFor refuses a malformed job request", async () => {
    const views = detailStores(await seededStores([{ id: "a" }]));
    const requests = [{ ats: "", jobId: "a" }, { ats: "x".repeat(33), jobId: "a" }, { ats: "greenhouse", jobId: "" }, { ats: "greenhouse", jobId: "x".repeat(256) }, { ats: "greenhouse" }, "greenhouse:a"];
    for (const request of requests) await expect(loadDetailsFor(views, config, request)).rejects.toThrow("Invalid job request");
});

test("loadDetailsFor returns a known job's details and null for an unknown one", async () => {
    const views = detailStores(await seededStores([{ id: "a" }]));
    expect((await loadDetailsFor(views, config, JOB_A))?.job).toMatchObject({ jobId: "a", title: "Software Engineer a", pay: null });
    expect(await loadDetailsFor(views, config, { ats: "greenhouse", jobId: "nope" })).toBeNull();
});

test("loadDetailsFor includes the job's score history and its re-scores, newest first", async () => {
    const stores = await seededStores([{ id: "a", score: 70 }]);
    await stores.jobStore.recordVerdict({ job_id: "a", score: 80, reasons: [], gaps: [] }, { scoredAt: "2026-10-03T00:00:00.000Z", runId: "run-2" });
    await stores.rescoreLog.begin(JOB_A, "run-3", "2026-10-04T00:00:00.000Z");
    await stores.rescoreLog.end("run-3", { outcome: "filtered", filter: "title", score: null }, "2026-10-04T00:00:01.000Z");
    expect((await loadDetailsFor(detailStores(stores), config, JOB_A))?.history.map((entry) => [entry.total, entry.run, entry.rescore?.state ?? null])).toEqual([
        [null, "run-3", "filtered"],
        [80, "run-2", null],
        [70, "run-1", null],
    ]);
});

const NOW = new Date("2026-10-23T16:40:00.000Z");
const LATER = new Date("2026-10-24T08:00:00.000Z");

test("marking a job applied records the time it was marked", async () => {
    const views = await seededViews([{ id: "a" }]);
    expect(await setAppliedFor(views, { ...JOB_A, applied: true }, NOW)).toEqual({ ok: true, appliedOn: NOW.toISOString() });
});

test("marking an applied job again keeps the time it was first marked", async () => {
    const views = await seededViews([{ id: "a" }]);
    await setAppliedFor(views, { ...JOB_A, applied: true }, NOW);
    expect(await setAppliedFor(views, { ...JOB_A, applied: true }, LATER)).toEqual({ ok: true, appliedOn: NOW.toISOString() });
});

test("undoing the mark clears its time", async () => {
    const views = await seededViews([{ id: "a" }]);
    await setAppliedFor(views, { ...JOB_A, applied: true }, NOW);
    expect(await setAppliedFor(views, { ...JOB_A, applied: false }, LATER)).toEqual({ ok: true, appliedOn: null });
});

test("marking an unknown job reports that there is no such job", async () => {
    const views = await seededViews([{ id: "a" }]);
    expect(await setAppliedFor(views, { ats: "greenhouse", jobId: "missing", applied: true }, NOW)).toEqual({ ok: false, error: "No such job." });
});

test("an applied request without a source is refused", async () => {
    await expect(setAppliedFor(await seededViews([{ id: "a" }]), { jobId: "a", applied: true }, NOW)).rejects.toThrow("Invalid applied request");
});

test("an applied request with an empty job id is refused", async () => {
    await expect(setAppliedFor(await seededViews([{ id: "a" }]), { ...JOB_A, jobId: "", applied: true }, NOW)).rejects.toThrow("Invalid applied request");
});

test("an applied request that isn't yes or no is refused", async () => {
    await expect(setAppliedFor(await seededViews([{ id: "a" }]), { ...JOB_A, applied: "yes" }, NOW)).rejects.toThrow("Invalid applied request");
});

function fakeOpener(begun: BeginResult) {
    const calls: string[] = [];
    const log = { step: () => {}, end: async (end: RescoreEnd) => void calls.push(`end ${end.outcome}`) };
    const deps = { trace: memoryTrace(), fallbacks: 0, store: { findJob: async () => null } as Partial<JobStore> as JobStore, log } as Partial<RescoreDeps> as RescoreDeps;
    const opened = { deps, begin: async () => (calls.push("begin"), begun), close: async () => void calls.push("close") };
    return { calls, open: async () => (calls.push("open"), opened) };
}

test("a re-score asked for while one is open gives that run, does no work and closes, and a malformed request opens nothing", async () => {
    const running = fakeOpener({ running: "run-1" });
    const missing = fakeOpener({ missing: true });
    expect([await startRescoreFor(running.open, JOB_A), await startRescoreFor(missing.open, { ats: "greenhouse", jobId: "gone" }), await startRescoreFor(running.open, { ats: "", jobId: "a" })]).toEqual([{ run: "run-1" }, { failed: true }, { failed: true }]);
    expect([running.calls, missing.calls]).toEqual([
        ["open", "begin", "close"],
        ["open", "begin", "close"],
    ]);
});

test("a started re-score gives its run and the work, which runs the re-score to its end and then closes", async () => {
    const started = fakeOpener({ started: "run-2" });
    const result = await startRescoreFor(started.open, JOB_A);
    expect([result, started.calls]).toEqual([{ run: "run-2", work: expect.any(Function) }, ["open", "begin"]]);
    if ("work" in result) await result.work();
    expect(started.calls).toEqual(["open", "begin", "end failed", "close"]);
});
