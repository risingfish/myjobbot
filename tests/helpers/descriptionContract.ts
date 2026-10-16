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

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [["an upsert marks a stored description as coming from the job's own source", case1]];

export function descriptionContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
