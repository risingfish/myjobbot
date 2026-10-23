import { expect, test } from "vitest";
import { makeJob } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

const SEEN = "2026-10-20T12:00:00.000Z";
const DETAILS = { compensation: "$150k–$180k", workplaceType: "hybrid", isRemote: false, location: "Denver, CO", description: "Build APIs.", requirements: ["5 years of Go"], skills: ["Go", "SQL"], preferredSkills: ["Kafka"] };

function job(ats: "greenhouse" | "lever", jobId: string) {
    return makeJob({ ats, jobId, company: "Acme", title: "Backend Engineer", url: `https://example.com/${ats}/${jobId}` }, DETAILS);
}

async function case1(make: MakeStores) {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([job("greenhouse", "a")], SEEN, "Acme");
    await jobStore.recordVerdict({ job_id: "a", score: 70, base: 60, bonus: 10, reasons: ["Go"], gaps: ["Kafka"] }, { scoredAt: SEEN, runId: "run-1" });
    await jobStore.setDescription({ ats: "greenhouse", jobId: "a" }, { description: "Build APIs in Go.", format: "text", url: "https://acme.example/jobs/a", source: "careers" });
    await jobStore.flagInjection("a", "2026-10-20T13:00:00.000Z");
    await jobViews.setHidden({ ats: "greenhouse", jobId: "a", hidden: true });
    expect(await jobViews.jobDetail({ ats: "greenhouse", jobId: "a" })).toMatchObject({
        ...{ ats: "greenhouse", job_id: "a", source: "Acme", compensation: "$150k–$180k", workplace_type: "hybrid", is_remote: 0 },
        ...{ description: "Build APIs in Go.", description_source: "careers", description_url: "https://acme.example/jobs/a", requirements: ["5 years of Go"], skills: ["Go", "SQL"], preferred_skills: ["Kafka"] },
        ...{ score: 70, base_score: 60, bonus_score: 10, reasons: ["Go"], gaps: ["Kafka"], hidden: true, injection_seen_at: "2026-10-20T13:00:00.000Z" },
    });
}

async function case2(make: MakeStores) {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([job("greenhouse", "a")], SEEN, "Acme");
    expect(await jobViews.jobDetail({ ats: "greenhouse", jobId: "missing" })).toBeNull();
    expect(await jobViews.jobDetail({ ats: "lever", jobId: "a" })).toBeNull();
}

async function case3(make: MakeStores) {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([job("greenhouse", "a"), job("lever", "a")], SEEN, "Acme");
    expect((await jobViews.jobDetail({ ats: "lever", jobId: "a" }))?.url).toBe("https://example.com/lever/a");
}

async function case4(make: MakeStores) {
    const { jobStore, jobViews } = await make();
    await jobStore.upsertAll([job("greenhouse", "a"), job("lever", "a"), job("greenhouse", "b")], SEEN, "Acme");
    const verdicts: Array<[string, number, string]> = [
        ["a", 50, "2026-10-20T13:00:00.000Z"],
        ["a", 60, "2026-10-21T13:00:00.000Z"],
        ["b", 70, "2026-10-21T13:00:00.000Z"],
        ["a", 65, "2026-10-21T13:00:00.000Z"],
    ];
    for (const [jobId, score, scoredAt] of verdicts) await jobStore.recordVerdict({ job_id: jobId, score, base: score - 10, bonus: 10, reasons: [], gaps: [] }, { scoredAt, runId: `run-${score}` });
    const listed = await jobViews.jobVerdicts({ ats: "greenhouse", jobId: "a" });
    expect(listed.map((verdict) => [verdict.score, verdict.base_score, verdict.scored_at, verdict.run_id])).toEqual([
        [65, 55, "2026-10-21T13:00:00.000Z", "run-65"],
        [60, 50, "2026-10-21T13:00:00.000Z", "run-60"],
        [50, 40, "2026-10-20T13:00:00.000Z", "run-50"],
    ]);
    expect(await jobViews.jobVerdicts({ ats: "greenhouse", jobId: "missing" })).toEqual([]);
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["one job's details come back with its terms, description, lists, score parts and flags", case1],
    ["an unknown job, or a known id on another board, gives no details", case2],
    ["the same id on two boards gives each board's own job", case3],
    ["a job's verdicts are only its own, newest first, later verdicts first on a tie", case4],
];

export function jobDetailContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
