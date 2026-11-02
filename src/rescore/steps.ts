import { z } from "zod";
import { MODEL_REASONS } from "../careers/session.js";
import type { JobKey } from "../db/store.js";
import { isWebAddress } from "../descriptions/webAddress.js";
import { FILTER_NOTES } from "../jobs/filterMatch.js";

const MAX_SHOWN = 120;
const REASONS = [...MODEL_REASONS, "fetch_refused", "timed_out", "gave_up", "lookup_error", "search_unavailable"] as const;
const CONTROL = /\p{Cc}/u;

const count = z.number().int().min(0);
const reason = z.enum(REASONS).nullable();
const filter = z.enum(["company", "title", "body"]);
const address = z
    .string()
    .max(2000)
    .refine((url) => isWebAddress(url) && !CONTROL.test(url));
const none = z.strictObject({});

const SCHEMAS = {
    settings: z.strictObject({ fallbacks: count }),
    filters: z.strictObject({ by: filter.nullable() }),
    lookup: none,
    search: z.strictObject({ chars: count.nullable(), ok: z.boolean() }),
    page: z.strictObject({ kind: z.enum(["careers", "job"]), url: address, chars: count.nullable(), via: z.enum(["download", "board", "browser"]).nullable(), ok: z.boolean(), reason }),
    lookup_end: z.strictObject({ found: z.boolean(), reason }),
    lookup_failed: none,
    reading: none,
    lookalike: none,
    saved: z.strictObject({ score: count }),
    outcome: z.strictObject({ outcome: z.enum(["scored", "filtered", "failed"]), filter: filter.nullable(), score: count.nullable() }),
};

type Schemas = typeof SCHEMAS;
type StepKind = keyof Schemas;

export type Step = { [K in StepKind]: { kind: K; fields: z.infer<Schemas[K]> } }[StepKind];

type Lines = { [K in StepKind]: (fields: z.infer<Schemas[K]>) => string };

const LINES: Lines = {
    settings: ({ fallbacks }) => (fallbacks === 0 ? "settings loaded" : `settings loaded (${fallbacks} fell back)`),
    filters: ({ by }) => (by === null ? "filters passed" : `filtered: ${FILTER_NOTES[by]}`),
    lookup: () => "no description: looking for the careers page",
    search: ({ chars, ok }) => (ok ? `searched the web (${sized(chars)} chars of results)` : "web search failed"),
    page: pageLine,
    lookup_end: ({ found, reason: why }) => (found ? "description found" : `no description found${because(why)}`),
    lookup_failed: () => "careers lookup failed; scoring from what we have",
    reading: () => "model reading the job",
    lookalike: () => "removed a look-alike marker from the job's text",
    saved: ({ score }) => `model score saved: ${score}`,
    outcome: outcomeLine,
};

/** Reads a stored step back as one the terminal may show, or null when its kind is unknown or a field breaks its rules, so no other text can reach a line. */
export function parseStep(kind: string, fields: unknown): Step | null {
    if (!Object.hasOwn(SCHEMAS, kind)) return null;
    const parsed = SCHEMAS[kind as StepKind].safeParse(fields);
    return parsed.success ? ({ kind, fields: parsed.data } as Step) : null;
}

/** Builds a step's terminal line from its fields alone, the only place a line's text is made. */
export function stepLine(step: Step): string {
    return (LINES[step.kind] as (fields: Step["fields"]) => string)(step.fields);
}

/** Gives the command line a re-score's log starts with. */
export function commandLine(key: JobKey): string {
    return `$ myjobbot rescore ${key.ats} ${key.jobId}`;
}

/** Prefixes a line with the seconds since its run started, as the CLI and the terminal show it. */
export function consoleLine(line: string, elapsedMs: number): string {
    return `[${(elapsedMs / 1000).toFixed(1).padStart(5)}s] ${line}`;
}

/** Says a job's re-score can't start because one is already running. */
export function alreadyRunningLine(key: JobKey, runId: string): string {
    return `rescore ${key.ats} ${key.jobId}: already running (${runId})`;
}

/** Shows a page the lookup opened: its address, and its size and how it was read, or that it failed. */
function pageLine({ kind, url, chars, via, ok, reason: why }: z.infer<Schemas["page"]>): string {
    const read = chars === null ? "" : `  ${sized(chars)} chars${via === null ? "" : `  ${via}`}`;
    return `open ${kind} page ${shortened(url)}${read}${ok ? "" : `  failed${because(why)}`}`;
}

/** Says how a re-score ended. */
function outcomeLine({ outcome, filter: by, score }: z.infer<Schemas["outcome"]>): string {
    if (outcome === "scored") return `done: model score ${score ?? "?"}`;
    if (outcome === "filtered" && by !== null) return `done: not re-scored, ${FILTER_NOTES[by]}`;
    return "done: failed, old score kept";
}

/** Writes a size with thousands separators. */
function sized(chars: number | null): string {
    return chars === null ? "?" : chars.toLocaleString("en-US");
}

/** Adds a reason code in brackets, when there is one. */
function because(why: string | null): string {
    return why === null ? "" : ` (${why})`;
}

/** Cuts a long address so a line stays readable. */
function shortened(url: string): string {
    return url.length > MAX_SHOWN ? `${url.slice(0, MAX_SHOWN - 1)}…` : url;
}
