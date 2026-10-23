import { expect, test } from "vitest";
import type { Verdict, VerdictView } from "../src/db/store.js";
import { makeJob } from "../src/jobs/job.js";
import { toJobDetailView } from "../src/web/jobDetail.js";
import { rowContext } from "../src/web/pageData.js";
import { testFileConfig } from "./helpers/config.js";
import { memoryStores } from "./helpers/memoryStore.js";

const context = rowContext(testFileConfig(), new Date("2026-10-03T00:00:00.000Z"));
const KEY = { ats: "greenhouse", jobId: "a" };

async function storedDetail(details: Parameters<typeof makeJob>[1], verdict?: Verdict) {
    const stores = memoryStores();
    const job = makeJob({ ats: "greenhouse", jobId: "a", company: "Acme", title: "Backend Engineer", url: "https://example.com/a" }, { postedAt: "2026-09-30T00:00:00.000Z", ...details });
    await stores.jobStore.upsertAll([job], "2026-10-01T00:00:00.000Z", "Stripe");
    if (verdict) await stores.jobStore.recordVerdict(verdict, { scoredAt: "2026-10-02T09:30:00.000Z", runId: "run-1" });
    const row = await stores.jobViews.jobDetail(KEY);
    if (row === null) throw new Error("seeded job missing");
    return row;
}

test("a job's details carry its row view plus its pay and workplace terms", async () => {
    const view = toJobDetailView(await storedDetail({ compensation: "$150k", workplaceType: "hybrid", location: "Denver" }), [], context);
    expect(view.job).toMatchObject({ ats: "greenhouse", jobId: "a", title: "Backend Engineer", company: "Acme", location: "Denver", source: "Stripe", pay: "$150k", workplace: "hybrid" });
    expect(view.job.posted).toEqual({ date: "2026-09-30", daysOpen: 3, ghost: false });
});

test("missing pay and workplace terms are null", async () => {
    expect(toJobDetailView(await storedDetail({}), [], context).job).toMatchObject({ pay: null, workplace: null });
});

test("an unscored job has no score", async () => {
    expect(toJobDetailView(await storedDetail({}), [], context).score).toBeNull();
});

test("a scored job's score gives the boosted total, the model's score, the boost and the parts behind it", async () => {
    const boosted = rowContext(testFileConfig({ title_boosts: { backend: 5 } }), new Date("2026-10-03T00:00:00.000Z"));
    const row = await storedDetail({}, { job_id: "a", score: 70, base: 40, bonus: 30, reasons: ["Go"], gaps: ["Kafka"] });
    expect(toJobDetailView(row, [], boosted).score).toEqual({ total: 75, model: 70, boost: "+5 backend", base: 40, bonus: 30, reasons: ["Go"], gaps: ["Kafka"], scoredAt: "2026-10-02 09:30" });
    expect(toJobDetailView(row, [], context).score).toMatchObject({ total: 70, model: 70, boost: null });
});

test("a job without a description says so, with no origin", async () => {
    expect(toJobDetailView(await storedDetail({}), [], context).description).toEqual({ text: null, format: null, requirements: [], skills: [], preferredSkills: [], origin: null });
});

test("a description from the job's own source carries its requirements and skills", async () => {
    const row = await storedDetail({ description: "Build APIs.\nShip often.", requirements: ["5 years of Go"], skills: ["Go", "SQL"], preferredSkills: ["Kafka"] });
    expect(toJobDetailView(row, [], context).description).toEqual({ text: "Build APIs.\nShip often.", format: "text", requirements: ["5 years of Go"], skills: ["Go", "SQL"], preferredSkills: ["Kafka"], origin: { kind: "source" } });
});

test("a description found on a careers page links that page, but only a web address", async () => {
    const row = await storedDetail({ description: "Build APIs." });
    const careers = { ...row, description_source: "careers", description_url: "https://acme.example/jobs/a" };
    expect(toJobDetailView(careers, [], context).description.origin).toEqual({ kind: "careers", url: "https://acme.example/jobs/a" });
    expect(toJobDetailView({ ...careers, description_url: "javascript:alert(1)" }, [], context).description.origin).toEqual({ kind: "careers", url: null });
});

test("a job with no injection flag has no warnings, and a flagged one warns with the date it was seen", async () => {
    const row = await storedDetail({});
    expect(toJobDetailView(row, [], context).warnings).toEqual([]);
    expect(toJobDetailView({ ...row, injection_seen_at: "2026-10-20T13:05:00.000Z" }, [], context).warnings).toEqual(["On 2026-10-20 13:05, text from this job's pages tried to escape the data markers that keep it apart from the model's instructions. It was removed before the model read it."]);
});

test("the history lists each verdict in the order given, with its time, score, parts and run", async () => {
    const verdict = ([id, score, base, run]: [number, number, number | null, string | null]): VerdictView => ({ id, run_id: run, scored_at: `2026-10-2${id}T08:15:00.000Z`, score, base_score: base, bonus_score: base === null ? null : score - base, reasons: [], gaps: [], title: null, company: null, url: null, source: null });
    const history = toJobDetailView(await storedDetail({}), [verdict([2, 60, 40, "0f29a1a3-d408-4fdc"]), verdict([1, 45, null, null])], context).history;
    expect(history).toEqual([
        { scoredAt: "2026-10-22 08:15", total: 60, base: 40, bonus: 20, run: "0f29a1a3" },
        { scoredAt: "2026-10-21 08:15", total: 45, base: null, bonus: null, run: null },
    ]);
});
