import { expect, test } from "vitest";
import type { AuditEntry, CareersStore } from "../src/db/store.js";
import type { Step } from "../src/rescore/steps.js";
import { loggedCareers, stepsFromTrace } from "../src/rescore/traceSteps.js";
import { memoryTrace } from "./helpers/trace.js";

const BASE = { runId: "r", at: "2026-11-03T10:00:00.000Z", ats: "linkedin", jobId: "9", company: "BigPanda" };
const PAGE = "https://www.bigpanda.io/company/panda-way/jobs/";

function audit(entry: Partial<AuditEntry> & Pick<AuditEntry, "step" | "outcome">): AuditEntry {
    return { ...BASE, url: null, reason: null, ...entry };
}

async function stepsOf(entries: AuditEntry[]): Promise<Array<Step | null>> {
    const written: AuditEntry[] = [];
    const steps: Array<Step | null> = [];
    for (const entry of entries) {
        const logged: Step[] = [];
        await loggedCareers({ audit: async (row: AuditEntry) => void written.push(row) } as Partial<CareersStore> as CareersStore, { step: (step) => void logged.push(step) }).audit(entry);
        steps.push(logged[0] ?? null);
    }
    expect(written).toEqual(entries);
    return steps;
}

test("a search keeps only its size, never its query, and each open keeps its address, size and how it was read", async () => {
    expect(await stepsOf([audit({ step: "search", url: "BigPanda careers", chars: 2201, outcome: "ok" }), audit({ step: "open_careers", url: PAGE, chars: 6193, pageSource: "html", outcome: "ok", detail: "page text" }), audit({ step: "open_job", url: PAGE, chars: 12019, pageSource: "board", outcome: "ok" }), audit({ step: "open_job", url: PAGE, chars: 900, pageSource: "rendered", outcome: "ok" })])).toEqual([
        { kind: "search", fields: { chars: 2201, ok: true } },
        { kind: "page", fields: { kind: "careers", url: PAGE, chars: 6193, via: "download", ok: true, reason: null } },
        { kind: "page", fields: { kind: "job", url: PAGE, chars: 12019, via: "board", ok: true, reason: null } },
        { kind: "page", fields: { kind: "job", url: PAGE, chars: 900, via: "browser", ok: true, reason: null } },
    ]);
});

test("a failed open keeps its reason, a stale remembered page keeps its size, and the finish says what was found", async () => {
    expect(await stepsOf([audit({ step: "open_job", url: PAGE, outcome: "failed", reason: "timed_out" }), audit({ step: "open_careers", url: PAGE, chars: 300, pageSource: "html", outcome: "failed", detail: "stale" }), audit({ step: "finish", url: PAGE, outcome: "found" }), audit({ step: "finish", url: null, outcome: "failed", reason: "gave_up" })])).toEqual([
        { kind: "page", fields: { kind: "job", url: PAGE, chars: null, via: null, ok: false, reason: "timed_out" } },
        { kind: "page", fields: { kind: "careers", url: PAGE, chars: 300, via: "download", ok: false, reason: null } },
        { kind: "lookup_end", fields: { found: true, reason: null } },
        { kind: "lookup_end", fields: { found: false, reason: "gave_up" } },
    ]);
});

test("retries, render checks, remembered pages and skipped lookups make no step", async () => {
    expect(await stepsOf([audit({ step: "retry", outcome: "ok" }), audit({ step: "render_check", url: PAGE, outcome: "ok" }), audit({ step: "remembered", url: PAGE, outcome: "ok" }), audit({ step: "skipped", outcome: "failed", reason: "search_unavailable" })])).toEqual([null, null, null, null]);
});

test("the trace wrapper logs the model reading the job and a removed look-alike, ignores everything else, and still writes every event", () => {
    const trace = memoryTrace();
    const logged: Step[] = [];
    const wrapped = stepsFromTrace(trace, { step: (step) => void logged.push(step) });
    const events = [
        { type: "tool", name: "get_job", content: "job text" },
        { type: "tool", name: "record_matches" },
        { type: "lookalike_removed", tool: "get_job" },
        { type: "assistant", content: "model text" },
    ];
    for (const event of events) wrapped.write(event);
    expect([logged, trace.events]).toEqual([
        [
            { kind: "reading", fields: {} },
            { kind: "lookalike", fields: {} },
        ],
        events,
    ]);
});
