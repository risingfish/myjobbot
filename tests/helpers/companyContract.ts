import { expect, test } from "vitest";
import type { Stores } from "../../src/db/store.js";
import { makeJob, type Ats } from "../../src/jobs/job.js";
import type { MakeStores } from "./storeContract.js";

export interface CompanyRecord {
    id: number;
    company_key: string;
    name: string;
    created_date: string;
    last_found_date: string;
}

export interface UnlinkedJob {
    jobId: string;
    company: string;
    firstSeen: string;
    lastSeen: string;
}

export interface CompanyHooks {
    listCompanies(): Promise<CompanyRecord[]>;
    jobLinks(): Promise<Array<{ job_id: string; company_id: number | null }>>;
    seedUnlinked(jobs: UnlinkedJob[]): Promise<void>;
}

interface Contract {
    stores: Stores;
    hooks: CompanyHooks;
}

const DAY_ONE = "2026-10-01T00:00:00.000Z";
const DAY_TWO = "2026-10-02T00:00:00.000Z";
const DAY_THREE = "2026-10-03T00:00:00.000Z";
const LONG_AGO = "2026-09-01T00:00:00.000Z";

function job(jobId: string, company: string, ats: Ats | "jsearch" | "linkedin" = "greenhouse") {
    return makeJob({ ats, jobId, company, title: "Backend Engineer", url: `https://example.com/${jobId}` }, {});
}

async function recordsOnceFromEverySource({ stores, hooks }: Contract): Promise<void> {
    await stores.jobStore.upsertAll([job("board", "Acme")], DAY_ONE, "Acme");
    await stores.jobStore.upsertAll([job("search", "ACME, Inc.", "jsearch")], DAY_ONE, "Remote TypeScript");
    await stores.jobStore.upsertAll([job("li_1", "Acme LLC", "linkedin")], DAY_ONE, "LinkedIn alerts");
    const [acme, ...others] = await hooks.listCompanies();
    expect([acme, others]).toEqual([{ id: expect.any(Number), company_key: "acme", name: "Acme", created_date: DAY_ONE, last_found_date: DAY_ONE }, []]);
    expect((await hooks.jobLinks()).map((link) => link.company_id)).toEqual([acme?.id, acme?.id, acme?.id]);
}

async function movesLastFoundOnly({ stores, hooks }: Contract): Promise<void> {
    await stores.jobStore.upsertAll([job("board", "ACME")], DAY_TWO, "Acme");
    expect(await hooks.listCompanies()).toMatchObject([{ name: "Acme", created_date: DAY_ONE, last_found_date: DAY_TWO }]);
    await stores.jobStore.markSeen([{ ats: "linkedin", jobId: "li_1" }], DAY_THREE);
    expect(await hooks.listCompanies()).toMatchObject([{ created_date: DAY_ONE, last_found_date: DAY_THREE }]);
}

async function skipsNamesWithoutLetters({ stores, hooks }: Contract): Promise<void> {
    await stores.jobStore.upsertAll([job("blank", "!!!")], DAY_TWO, "Board");
    expect((await hooks.listCompanies()).length).toBe(1);
    expect((await hooks.jobLinks()).find((link) => link.job_id === "blank")?.company_id).toBeNull();
}

async function backfillsUnlinkedJobs({ stores, hooks }: Contract): Promise<void> {
    await hooks.seedUnlinked([
        { jobId: "old_2", company: "BETA LABS", firstSeen: DAY_ONE, lastSeen: DAY_THREE },
        { jobId: "old_1", company: "Beta Labs Inc", firstSeen: LONG_AGO, lastSeen: DAY_ONE },
    ]);
    expect(await stores.jobStore.linkUnlinkedJobs()).toBe(2);
    const beta = (await hooks.listCompanies()).find((company) => company.company_key === "beta labs");
    expect(beta).toMatchObject({ name: "Beta Labs Inc", created_date: LONG_AGO, last_found_date: DAY_THREE });
    expect((await hooks.jobLinks()).filter((link) => link.company_id === beta?.id).length).toBe(2);
    expect(await stores.jobStore.linkUnlinkedJobs()).toBe(0);
}

async function keptThroughPruning({ stores, hooks }: Contract): Promise<void> {
    await stores.jobStore.pruneLastSeenBefore("2027-01-01T00:00:00.000Z");
    expect([(await hooks.jobLinks()).length, (await hooks.listCompanies()).length]).toEqual([0, 2]);
}

export function companyContract(make: MakeStores, hooks: CompanyHooks): void {
    test("companies are recorded once, linked, kept through pruning and searched by the rules", async () => {
        const contract = { stores: await make(), hooks };
        await recordsOnceFromEverySource(contract);
        await movesLastFoundOnly(contract);
        await skipsNamesWithoutLetters(contract);
        await backfillsUnlinkedJobs(contract);
        await keptThroughPruning(contract);
    });
}
