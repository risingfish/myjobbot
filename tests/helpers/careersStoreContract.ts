import { expect, test } from "vitest";
import type { AuditEntry } from "../../src/db/store.js";
import type { MakeStores } from "./storeContract.js";

export interface PageFields {
    pageSource: string | null;
    fallback: string | null;
    board: string | null;
}

export interface CareersHooks {
    pageFields(): Promise<PageFields[]>;
}

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

async function case3(make: MakeStores) {
    const { careers } = await make();
    expect(await careers.rememberedPage("acme")).toBeNull();
    await careers.rememberPage({ companyKey: "acme", company: "Acme", url: "https://acme.example/careers" }, DAY_ONE);
    await careers.rememberPage({ companyKey: "acme", company: "Acme Inc", url: "https://acme.example/jobs" }, DAY_ONE);
    await careers.usePage("acme", DAY_TWO);
    expect(await careers.rememberedPage("acme")).toEqual({ company_key: "acme", company: "Acme Inc", url: "https://acme.example/jobs", found_at: DAY_ONE, last_used_at: DAY_TWO });
}

async function case4(make: MakeStores) {
    const { careers } = await make();
    await careers.rememberPage({ companyKey: "acme", company: "Acme", url: "https://acme.example/careers" }, DAY_ONE);
    await careers.rememberPage({ companyKey: "beta", company: "Beta", url: "https://beta.example/careers" }, DAY_ONE);
    await careers.forgetPage("acme");
    expect(await careers.rememberedPage("acme")).toBeNull();
    expect(await careers.rememberedPage("beta")).toMatchObject({ url: "https://beta.example/careers" });
}

async function case5(make: MakeStores, hooks: CareersHooks) {
    const { careers } = await make();
    await careers.audit(entry("li_html", { step: "open_job", outcome: "ok", reason: null, pageSource: "html", fallback: null, board: null }));
    await careers.audit(entry("li_board", { step: "open_careers", outcome: "ok", reason: null, pageSource: "html", fallback: "board_failed,render_off", board: "ashby:Vetcove" }));
    await careers.audit(entry("li_plain"));
    expect(await hooks.pageFields()).toEqual([
        { pageSource: "html", fallback: null, board: null },
        { pageSource: "html", fallback: "board_failed,render_off", board: "ashby:Vetcove" },
        { pageSource: null, fallback: null, board: null },
    ]);
}

const CASES: Array<[string, (make: MakeStores, hooks: CareersHooks) => Promise<void>]> = [
    ["only lookups that ended for good count as attempted, never steps, retryable failures or skipped rows", case1],
    ["pruning removes only audit rows before the cutoff", case2],
    ["a careers page is remembered per company, replaced when found again, and its last use updated", case3],
    ["forgetting a careers page removes only that company's", case4],
    ["an open step keeps how its page was read, its fallbacks and its board", case5],
];

export function careersStoreContract(make: MakeStores, hooks: CareersHooks): void {
    for (const [name, run] of CASES) test(name, () => run(make, hooks));
}
