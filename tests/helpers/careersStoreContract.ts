import { expect, test } from "vitest";
import type { AuditEntry } from "../../src/db/store.js";
import type { MakeStores } from "./storeContract.js";

const DAY_ONE = "2026-10-16T12:00:00.000Z";
const DAY_TWO = "2026-10-17T12:00:00.000Z";

function entry(jobId: string, overrides: Partial<AuditEntry> = {}): AuditEntry {
    return { runId: "run-1", at: DAY_ONE, ats: "linkedin", jobId, company: "Acme", step: "finish", url: null, outcome: "failed", reason: "job_not_found", warning: true, ...overrides };
}

async function case1(make: MakeStores) {
    const { careers } = await make();
    await careers.audit(entry("li_done"));
    await careers.audit(entry("li_found", { outcome: "found", reason: null, warning: false }));
    await careers.audit(entry("li_steps", { step: "search", outcome: "ok", reason: null }));
    await careers.audit(entry("li_error", { reason: "lookup_error" }));
    await careers.audit(entry("", { ats: "", company: "", step: "skipped", reason: "search_unavailable" }));
    const keys = ["li_done", "li_found", "li_steps", "li_error", "li_new"].map((jobId) => ({ ats: "linkedin", jobId }));
    expect(await careers.attempted(keys)).toEqual([keys[0], keys[1]]);
    expect(await careers.attempted([])).toEqual([]);
}

async function case2(make: MakeStores) {
    const { careers } = await make();
    await careers.audit(entry("li_old", { detail: "x".repeat(3000) }));
    await careers.audit(entry("li_new", { at: DAY_TWO }));
    await careers.pruneAuditBefore(DAY_TWO);
    const keys = [
        { ats: "linkedin", jobId: "li_old" },
        { ats: "linkedin", jobId: "li_new" },
    ];
    expect(await careers.attempted(keys)).toEqual([keys[1]]);
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["only lookups that ended for good count as attempted, never steps, retryable failures or skipped rows", case1],
    ["pruning removes only audit rows before the cutoff", case2],
];

export function careersStoreContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
