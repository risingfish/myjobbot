import { expect, test } from "vitest";
import { makeJob } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

const SEEN = "2026-10-16T12:00:00.000Z";

function job(jobId: string, description: string | null) {
    return makeJob({ ats: "greenhouse", jobId, company: "Acme", title: "Backend Engineer", url: `https://example.com/${jobId}` }, { description });
}

async function case1(make: MakeStores) {
    const { jobStore } = await make();
    await jobStore.upsertAll([job("with", "Build APIs."), job("without", null)], SEEN, "Acme");
    expect(await jobStore.findJob("with")).toMatchObject({ description_source: "source", description_url: null });
    expect(await jobStore.findJob("without")).toMatchObject({ description_source: null, description_url: null });
}

async function case2(make: MakeStores) {
    const { jobStore } = await make();
    await jobStore.upsertAll([job("found", null)], SEEN, "Gmail alerts");
    await jobStore.recordVerdict({ job_id: "found", score: 40, reasons: [], gaps: [] }, { scoredAt: SEEN, runId: "run-1" });
    await jobStore.setDescription({ ats: "greenhouse", jobId: "found" }, { description: "Build APIs.", url: "https://acme.example/jobs/1", source: "careers" });
    expect(await jobStore.findJob("found")).toMatchObject({ description: "Build APIs.", description_source: "careers", description_url: "https://acme.example/jobs/1", score: 40, last_seen: SEEN, title: "Backend Engineer" });
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["an upsert marks a stored description as coming from the job's own source", case1],
    ["a careers description is stored with its address and changes nothing else", case2],
];

export function descriptionContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
