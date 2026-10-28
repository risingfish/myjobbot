import { expect, test } from "vitest";
import type { Stores } from "../../src/db/store.js";
import { makeJob, type Job } from "../../src/jobs/job.js";

export type MakeStores = () => Promise<Stores>;

const DAY_ONE = "2026-10-01T00:00:00.000Z";
const DAY_TWO = "2026-10-02T00:00:00.000Z";
const PAGE = { offset: 0, limit: 100 };

interface Sample {
    id: string;
    ats?: Job["ats"];
    company?: string;
    title?: string;
    postedAt?: string | null;
}

function sample({ id, ats = "greenhouse", company = "Stripe", title = "Backend Engineer", postedAt = null }: Sample) {
    return makeJob({ ats, jobId: id, company, title, url: `https://example.com/${id}` }, { postedAt });
}

function score(id: string, value: number, reasons = [`reason ${id}`]) {
    return { job_id: id, score: value, base: value - 10, bonus: 10, reasons, gaps: [`gap ${id}`] };
}

async function seededViews(make: MakeStores) {
    const stores = await make();
    const seeds: Array<[string, string, number | null, string | null]> = [
        ["a", "Search", 90, "2026-09-28T00:00:00.000Z"],
        ["b", "Search", 60, null],
        ["c", "Board", 95, "2026-09-20T00:00:00.000Z"],
        ["d", "Removed", 99, null],
        ["e", "Board", null, null],
    ];
    for (const [id, source, value, postedAt] of seeds) {
        await stores.jobStore.upsertAll([sample({ id, postedAt })], DAY_ONE, source);
        if (value !== null) await stores.jobStore.recordVerdict(score(id, value), { scoredAt: DAY_TWO, runId: "run-1" });
    }
    return stores;
}

async function case01(make: MakeStores): Promise<void> {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([sample({ id: "a" })], DAY_ONE, "Stripe");
    await jobStore.recordVerdict(score("a", 80), { scoredAt: DAY_ONE, runId: "r" });
    await jobViews.setHidden({ ats: "greenhouse", jobId: "a", hidden: true });
    await jobStore.upsertAll([sample({ id: "a", title: "Staff Engineer" })], DAY_TWO, "Stripe");
    expect((await jobViews.allJobs(PAGE))[0]).toMatchObject({ title: "Staff Engineer", first_seen: DAY_ONE, last_seen: DAY_TWO, score: 80, hidden: true });
}

async function case02(make: MakeStores): Promise<void> {
    const { jobStore } = await make();
    await jobStore.upsertAll([sample({ id: "b" }), sample({ id: "a" })], DAY_ONE, "Stripe");
    await jobStore.upsertAll([sample({ id: "b" })], DAY_TWO, "Stripe");
    expect((await jobStore.unscoredSince("Stripe", DAY_TWO)).map((row) => row.job_id)).toEqual(["b"]);
    await jobStore.recordVerdict(score("b", 70), { scoredAt: DAY_TWO, runId: "r" });
    expect((await jobStore.unscoredForSource("Stripe")).map((row) => row.job_id)).toEqual(["a"]);
    expect(await jobStore.unscoredForSource("Other")).toEqual([]);
}

async function case03(make: MakeStores): Promise<void> {
    const { jobStore } = await make();
    await jobStore.upsertAll([sample({ id: "1" }), sample({ id: "2" })], DAY_ONE, "Stripe");
    await jobStore.upsertAll([sample({ id: "js", ats: "jsearch", company: "Acme" })], DAY_ONE, "Search");
    expect(await jobStore.boardCompaniesWithTitle("backend engineer")).toEqual(["Stripe"]);
}

async function case04(make: MakeStores): Promise<void> {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([sample({ id: "x" }), sample({ id: "x", ats: "lever" })], DAY_ONE, "Stripe");
    expect(await jobStore.recordVerdict(score("x", 75), { scoredAt: DAY_TWO, runId: "run-9" })).toBe(true);
    expect(await jobStore.recordVerdict(score("missing", 75), { scoredAt: DAY_TWO, runId: "run-9" })).toBe(false);
    expect((await jobViews.allJobs(PAGE)).map((job) => [job.ats, job.score, job.base_score, job.bonus_score])).toEqual([
        ["greenhouse", 75, 65, 10],
        ["lever", 75, 65, 10],
    ]);
    expect(await jobViews.countVerdicts()).toBe(2);
}

async function case05(make: MakeStores): Promise<void> {
    const { jobStore } = await make();
    await jobStore.upsertAll([sample({ id: "old" })], "2026-06-01T00:00:00.000Z", "Stripe");
    await jobStore.upsertAll([sample({ id: "new", title: "Backend Engineer!", postedAt: "2026-09-01T00:00:00.000Z" })], DAY_TWO, "Stripe");
    expect(await jobStore.earliestSeen("Stripe", "backend engineer")).toBe("2026-06-01T00:00:00.000Z");
}

async function case06(make: MakeStores): Promise<void> {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([sample({ id: "1" })], DAY_ONE, "Stripe");
    await jobStore.upsertAll([sample({ id: "2" })], DAY_TWO, "Stripe");
    await jobStore.recordVerdict(score("1", 50), { scoredAt: DAY_ONE, runId: "r" });
    expect(await jobStore.pruneLastSeenBefore(DAY_TWO)).toBe(1);
    expect([await jobViews.countAllJobs(), await jobViews.countVerdicts()]).toEqual([1, 0]);
}

async function case07(make: MakeStores): Promise<void> {
    const { jobStore } = await make();
    const lists = { description: "Build APIs.", requirements: ["5+ years"], skills: ["Go"], preferredSkills: [] };
    await jobStore.upsertAll([makeJob({ ats: "jsearch", jobId: "js_1", company: "Acme", title: "Backend Engineer", url: "u" }, lists)], DAY_ONE, "Search");
    expect(await jobStore.findJob("js_1")).toMatchObject({ description: "Build APIs.", requirements: ["5+ years"], skills: ["Go"], preferred_skills: [] });
    expect(await jobStore.findJob("nope")).toBeNull();
}

async function case08(make: MakeStores): Promise<void> {
    const { jobViews } = await seededViews(make);
    expect((await jobViews.scoredFrom({ sources: ["Search", "Board"], minScore: 70 })).map((job) => job.job_id)).toEqual(["a", "c"]);
    await jobViews.setHidden({ ats: "greenhouse", jobId: "a", hidden: true });
    expect((await jobViews.scoredFrom({ sources: ["Search", "Board"], minScore: 70 })).map((job) => job.job_id)).toEqual(["c"]);
    expect(await jobViews.scoredFrom({ sources: [], minScore: 0 })).toEqual([]);
}

async function case09(make: MakeStores): Promise<void> {
    const { jobViews } = await seededViews(make);
    const all = (await jobViews.allJobs(PAGE)).map((job) => job.job_id);
    expect(all).toEqual(["b", "d", "e", "a", "c"]);
    const sliced = [];
    for (const offset of [0, 2, 4]) sliced.push(...(await jobViews.allJobs({ offset, limit: 2 })).map((job) => job.job_id));
    expect([sliced, await jobViews.countAllJobs()]).toEqual([all, 5]);
    expect((await jobViews.allJobs(PAGE)).find((job) => job.job_id === "e")).toMatchObject({ score: null, reasons: [], gaps: [] });
}

async function case10(make: MakeStores): Promise<void> {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([sample({ id: "a", title: "Senior Software Engineer" })], DAY_ONE, "Stripe");
    await jobStore.recordVerdict(score("a", 60, ["first"]), { scoredAt: DAY_ONE, runId: "run-1" });
    await jobStore.recordVerdict(score("a", 80, ["second"]), { scoredAt: DAY_TWO, runId: "run-2" });
    await jobStore.recordVerdict(score("a", 85, ["third"]), { scoredAt: DAY_TWO, runId: "run-2" });
    const history = (await jobViews.verdictHistory(PAGE)).map((verdict) => [verdict.score, verdict.reasons[0], verdict.title, verdict.company]);
    expect(history).toEqual([
        [85, "third", "Senior Software Engineer", "Stripe"],
        [80, "second", "Senior Software Engineer", "Stripe"],
        [60, "first", "Senior Software Engineer", "Stripe"],
    ]);
}

async function case11(make: MakeStores): Promise<void> {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([sample({ id: "a" })], DAY_ONE, "Stripe");
    expect(await jobViews.setHidden({ ats: "greenhouse", jobId: "a", hidden: true })).toBe(true);
    expect(await jobViews.setHidden({ ats: "greenhouse", jobId: "a", hidden: true })).toBe(true);
    expect(await jobViews.setHidden({ ats: "greenhouse", jobId: "missing", hidden: true })).toBe(false);
    expect((await jobViews.allJobs(PAGE))[0]?.hidden).toBe(true);
}

async function case12(make: MakeStores): Promise<void> {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([sample({ id: "abc", title: "Zürich C++ 🚀" }), sample({ id: "ABC" })], DAY_ONE, "Stripe");
    expect(await jobViews.countAllJobs()).toBe(2);
    expect((await jobStore.findJob("abc"))?.title).toBe("Zürich C++ 🚀");
}

async function case13(make: MakeStores): Promise<void> {
    const { apiCalls } = await make();
    await apiCalls.record("jsearch", "A", "2026-09-30T23:00:00.000Z");
    await apiCalls.record("jsearch", "A", "2026-10-02T10:00:00.000Z");
    await apiCalls.record("jsearch", "B", "2026-10-03T10:00:00.000Z");
    expect([await apiCalls.countSince("jsearch", DAY_ONE), await apiCalls.lastCallAt("jsearch", "A"), await apiCalls.lastCallAt("jsearch", "C")]).toEqual([2, "2026-10-02T10:00:00.000Z", null]);
    await apiCalls.pruneBefore(DAY_ONE);
    expect(await apiCalls.countSince("jsearch", "2000-01-01T00:00:00.000Z")).toBe(2);
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["an upsert refreshes the posting but keeps first seen, score and hidden", case01],
    ["unscored jobs are filtered by fetch and source, ordered by job id", case02],
    ["board companies with a title skip search results and repeat each company once", case03],
    ["a verdict scores every job with that id and is kept as history", case04],
    ["earliest seen takes the older of first seen and posted date across reposts", case05],
    ["pruning removes stale jobs and their verdict history", case06],
    ["a job is found by id with its description and lists, or null", case07],
    ["recommended jobs come from the given sources, meet the score, skip hidden, newest first", case08],
    ["all jobs list newest posted first, fall back to first seen, and page in stable slices", case09],
    ["verdict history is newest first, later verdicts first on a tie, joined to the job", case10],
    ["hiding reports whether the job exists, and setting the same value again still counts", case11],
    ["ids differing only in case are two jobs, and text round-trips exactly", case12],
    ["API calls are counted since a time, the last call is found, and old calls are pruned", case13],
];

export function storeContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
