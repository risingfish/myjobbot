import { expect, test } from "vitest";
import { makeJob } from "../../src/jobs/job.js";
import { normalizeTitle } from "../../src/jobs/normalize.js";
import type { MakeStores } from "./storeContract.js";

const SEEN = "2026-10-15T12:00:00.000Z";
const LATER = "2026-10-16T12:00:00.000Z";
const TITLE = "Senior Backend Engineer";

function job(ats: "greenhouse" | "jsearch" | "linkedin", jobId: string, company: string) {
    return makeJob({ ats, jobId, company, title: TITLE, url: `https://example.com/${jobId}` }, { description: `about ${jobId}`, compensation: "$150K" });
}

async function case1(make: MakeStores) {
    const { jobStore } = await make();
    await jobStore.upsertAll([job("greenhouse", "g1", "Acme")], SEEN, "Acme");
    await jobStore.upsertAll([job("jsearch", "js_1", "Beta")], SEEN, "Saved search");
    await jobStore.upsertAll([job("linkedin", "li_1", "Gamma")], SEEN, "Gmail alerts");
    expect((await jobStore.companiesWithTitleOutside("Gmail alerts", normalizeTitle(TITLE))).sort()).toEqual(["Acme", "Beta"]);
}

async function case2(make: MakeStores) {
    const { jobStore } = await make();
    await jobStore.upsertAll([job("linkedin", "li_2", "Gamma")], SEEN, "Gmail alerts");
    await jobStore.recordVerdict({ job_id: "li_2", score: 77, reasons: ["r"], gaps: [] }, { scoredAt: SEEN, runId: "run-1" });
    await jobStore.markSeen([{ ats: "linkedin", jobId: "li_2" }], LATER);
    expect(await jobStore.findJob("li_2")).toMatchObject({ last_seen: LATER, first_seen: SEEN, description: "about li_2", compensation: "$150K", score: 77 });
}

async function case3(make: MakeStores) {
    const { jobStore } = await make();
    await jobStore.upsertAll([job("linkedin", "li_3", "Gamma")], SEEN, "Gmail alerts");
    await jobStore.upsertAll([job("greenhouse", "g3", "Delta")], SEEN, "Delta");
    expect(await jobStore.boardCompaniesWithTitle(normalizeTitle(TITLE))).toEqual(["Delta"]);
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["companies with a title are found across every source but alerts", case1],
    ["marking a job seen moves only its last-seen time", case2],
    ["board copies ignore alert jobs", case3],
];

export function alertJobContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
