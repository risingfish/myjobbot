import { expect } from "vitest";
import type { CompanyRow } from "../../src/db/companyStore.js";
import type { Contract } from "./companyContract.js";

const SEARCHED_AT = "2027-03-01T00:00:00.000Z";
const BEFORE_SEARCH = "2027-02-01T00:00:00.000Z";
const LATER = "2027-06-01T00:00:00.000Z";

function keys(rows: CompanyRow[]): string[] {
    return rows.map((row) => row.company_key).sort();
}

async function dueCompanies({ stores }: Contract): Promise<CompanyRow[]> {
    const due = await stores.companies.dueForSearch(10, LATER);
    expect(keys(due)).toEqual(["acme", "beta labs", "delta", "gamma"]);
    expect(await stores.companies.dueForSearch(2, LATER)).toHaveLength(2);
    return due;
}

async function recordsOutcomes({ stores, hooks }: Contract, beta: CompanyRow): Promise<void> {
    const missed = { website: { url: "https://betalabs.com", reason: null, rejected: [] }, careers: { url: null, reason: "no_match" as const, rejected: ["https://reviews.example/beta"] } };
    await stores.companies.recordSearch(beta.id, missed, SEARCHED_AT);
    expect(await hooks.searchOutcome("beta labs")).toEqual({ website_url: "https://betalabs.com", website_reason: null, website_rejected: null, careers_url: null, careers_reason: "no_match", careers_rejected: JSON.stringify(["https://reviews.example/beta"]), searched_at: SEARCHED_AT });
    expect(keys(await stores.companies.dueForSearch(10, BEFORE_SEARCH))).not.toContain("beta labs");
    await stores.companies.recordSearch(beta.id, { website: null, careers: { url: "https://betalabs.com/careers", reason: null, rejected: [] } }, SEARCHED_AT);
    expect(await hooks.searchOutcome("beta labs")).toMatchObject({ careers_url: "https://betalabs.com/careers", careers_reason: null, careers_rejected: null });
    expect(keys(await stores.companies.dueForSearch(10, LATER))).not.toContain("beta labs");
}

async function marksUnavailable({ stores, hooks }: Contract, gamma: CompanyRow): Promise<void> {
    await stores.companies.markUnavailable([gamma.id], SEARCHED_AT);
    expect(await hooks.searchOutcome("gamma")).toMatchObject({ website_reason: "search_unavailable", careers_reason: null, searched_at: SEARCHED_AT });
}

export async function searchSteps(contract: Contract): Promise<void> {
    const due = await dueCompanies(contract);
    const byKey = (key: string) => due.find((row) => row.company_key === key) as CompanyRow;
    await recordsOutcomes(contract, byKey("beta labs"));
    await marksUnavailable(contract, byKey("gamma"));
}
