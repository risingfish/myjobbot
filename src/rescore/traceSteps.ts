import type { Trace, TraceEvent } from "../agent/trace.js";
import type { AuditEntry, CareersStore } from "../db/store.js";
import { parseStep, type Step } from "./steps.js";

type StepLog = { step(entry: Step): void };

const VIA: Record<string, string> = { html: "download", rendered: "browser", board: "board" };
const PAGE_KINDS: Record<string, string> = { open_careers: "careers", open_job: "job" };

/** Turns one careers lookup audit row into the step it shows, keeping only its address, size, read source and outcome code, or null for a row the terminal skips. */
function stepFromAudit(entry: AuditEntry): Step | null {
    const ok = entry.outcome !== "failed";
    if (entry.step === "search") return parseStep("search", { chars: entry.chars ?? null, ok });
    if (entry.step === "finish") return parseStep("lookup_end", { found: entry.outcome === "found", reason: entry.reason });
    const kind = PAGE_KINDS[entry.step];
    if (kind === undefined || entry.url === null) return null;
    const via = VIA[entry.pageSource ?? ""] ?? null;
    return parseStep("page", { kind, url: entry.url, chars: entry.chars ?? null, via, ok, reason: entry.reason });
}

/** Wraps a re-score's trace so the model reading the job and a removed look-alike marker are also logged as steps; every event is still written. */
export function stepsFromTrace(trace: Trace, log: StepLog): Trace {
    return {
        write: (event) => {
            trace.write(event);
            const step = traceStep(event);
            if (step !== null) log.step(step);
        },
    };
}

/** Wraps the careers store so each audit row the lookup writes is also logged as a step. */
export function loggedCareers(store: CareersStore, log: StepLog): CareersStore {
    return {
        careersPage: (companyKey) => store.careersPage(companyKey),
        setLookupPage: (page, at) => store.setLookupPage(page, at),
        clearLookupPage: (companyKey) => store.clearLookupPage(companyKey),
        audit: async (entry) => {
            await store.audit(entry);
            const step = stepFromAudit(entry);
            if (step !== null) log.step(step);
        },
        attempted: (keys) => store.attempted(keys),
        retries: () => store.retries(),
        pruneAuditBefore: (cutoff) => store.pruneAuditBefore(cutoff),
    };
}

/** Picks the step a trace event stands for, from its type and tool name only. */
function traceStep(event: TraceEvent): Step | null {
    if (event.type === "tool" && event.name === "get_job") return { kind: "reading", fields: {} };
    if (event.type === "lookalike_removed") return { kind: "lookalike", fields: {} };
    return null;
}
