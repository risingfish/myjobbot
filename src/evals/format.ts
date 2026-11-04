import { z } from "zod";
import { seriesRunSchema, seriesSchema } from "./seriesFormat.js";

const CURRENT = 1;
const MAX_DESCRIPTION = 6000;
const version = z.literal(CURRENT);
const iso = z.iso.datetime();
const count = z.number().int().min(0);
const part = z.number().int().min(0).max(50);
const total = z.number().int().min(0).max(100);
const words = z.array(z.string());
const tag = z.string().regex(/^[a-z0-9-]{1,40}$/);

/** Builds an inclusive range within 0 and a limit, its minimum not above its maximum. */
function range(limit: number) {
    const end = z.number().int().min(0).max(limit);
    return z
        .strictObject({ min: end, max: end })
        .refine((value) => value.min <= value.max, "min above max")
        .nullable();
}

const job = z.strictObject({
    job_id: z.string(),
    title: z.string(),
    location: z.string().optional(),
    department: z.string().optional(),
    team: z.string().optional(),
    workplace_type: z.string().optional(),
    is_remote: z.boolean().optional(),
    compensation: z.string().optional(),
    posted_at: z.string().optional(),
    days_open: count,
    possible_ghost: z.boolean(),
    description: z.string().max(MAX_DESCRIPTION).optional(),
    description_truncated: z.literal(true).optional(),
    description_from: z.string().optional(),
    requirements: words.optional(),
    skills: words.optional(),
    preferred_skills: words.optional(),
});

const observed = z.strictObject({ base: part.nullable(), bonus: part.nullable(), score: total, reasons: words, gaps: words, scoredAt: iso, runId: z.string().nullable(), read: z.enum(["details", "summary", "unknown"]) });
const dates = z.strictObject({ capturedAt: iso, daysOpenAtCapture: count, daysOpenAsScored: count, shiftedDays: count });

const caseShape = z.strictObject({
    schema: version,
    id: z.string().min(1),
    profile: z.string().min(1),
    source: z.strictObject({ ats: z.string().min(1), jobId: z.string().min(1) }),
    title: z.string(),
    company: z.string(),
    job,
    dates,
    observed: observed.nullable(),
    descriptionChangedSinceScored: z.boolean(),
    tags: z.array(tag).max(20),
});

/** Adds an issue for each way a case's dates disagree with each other or with the age it sends. */
function checkDates(value: z.infer<typeof caseShape>, context: z.RefinementCtx): void {
    const { daysOpenAtCapture, daysOpenAsScored, shiftedDays } = value.dates;
    const shiftWrong = shiftedDays !== daysOpenAtCapture - daysOpenAsScored || (value.observed === null && shiftedDays !== 0);
    if (shiftWrong) context.addIssue({ code: "custom", path: ["dates", "shiftedDays"], message: "shift disagrees with the ages" });
    if (value.job.days_open !== daysOpenAsScored) context.addIssue({ code: "custom", path: ["job", "days_open"], message: "age sent isn't the age as scored" });
}

const answerKeyFields = {
    verdict: z.enum(["recommend", "borderline", "reject", "zero"]),
    score: range(100),
    base: range(50),
    bonus: range(50),
    mustMention: z.array(z.string().min(1).max(60)).max(10),
    note: z.string().max(2000),
    writtenAt: iso,
};

const results = z.strictObject({
    schema: version,
    case: z.string().min(1),
    attempt: z.number().int().min(1),
    base: part.nullable(),
    bonus: part.nullable(),
    score: total.nullable(),
    reasons: words,
    gaps: words,
    failure: z.enum(["no_record", "invalid_tool_call", "timed_out", "model_error"]).nullable(),
    tokensIn: count.nullable(),
    tokensOut: count.nullable(),
    ms: count,
    passed: z.boolean().nullable(),
});

const runs = z.strictObject({
    schema: version,
    id: z.string().min(1),
    model: z.string().min(1),
    prompts: z.record(z.string(), z.string()).refine((map) => Object.keys(map).length > 0, "no prompt"),
    repeats: z.number().int().min(1).max(20),
    cases: z.array(z.string().min(1)).min(1),
    tags: z.array(tag),
    gitCommit: z.string().nullable(),
    startedAt: iso,
    endedAt: iso.nullable(),
    variant: z.string().nullable().optional(),
    promptChanged: z.boolean().optional(),
});

const SCHEMAS = {
    profile: z.strictObject({ schema: version, resume: z.string().min(1), preferences: z.string(), matchThreshold: total, ghostThresholdDays: z.number().int().min(1), capturedAt: iso }),
    case: caseShape.superRefine(checkDates),
    answer_key: z.strictObject({ schema: version, ...answerKeyFields, history: z.array(z.strictObject(answerKeyFields)).max(50) }),
    prompt: z.strictObject({ schema: version, text: z.string().min(1) }),
    run: runs,
    result: results,
    series: seriesSchema,
    series_run: seriesRunSchema,
};

export type FileKind = keyof typeof SCHEMAS;
export type Profile = z.infer<(typeof SCHEMAS)["profile"]>;
export type EvalCase = z.infer<(typeof SCHEMAS)["case"]>;
export type AnswerKey = z.infer<(typeof SCHEMAS)["answer_key"]>;
export type Prompt = z.infer<(typeof SCHEMAS)["prompt"]>;
export type Run = z.infer<(typeof SCHEMAS)["run"]>;
export type Result = z.infer<(typeof SCHEMAS)["result"]>;
type Shapes = { [K in FileKind]: z.infer<(typeof SCHEMAS)[K]> };
export type FileOf<K extends FileKind> = Shapes[K];

export type Parsed<T> = { ok: true; value: T } | { ok: false; problem: string };

/** Checks one file's contents against its kind's format, naming the first problem by its path and code only, so no file text is ever repeated. */
export function parseFile<K extends FileKind>(kind: K, raw: unknown): Parsed<FileOf<K>> {
    const stored = storedVersion(raw);
    if (stored !== null && stored !== CURRENT) return { ok: false, problem: `needs upgrade (schema ${stored})` };
    const parsed = SCHEMAS[kind].safeParse(raw);
    return parsed.success ? { ok: true, value: parsed.data as FileOf<K> } : { ok: false, problem: problemOf(parsed.error) };
}

/** Reads the format version a file says it has, or null when it names none. */
function storedVersion(raw: unknown): number | null {
    if (typeof raw !== "object" || raw === null || !("schema" in raw)) return null;
    return typeof raw.schema === "number" ? raw.schema : null;
}

/** Names a format error by its first issue's path and code. */
function problemOf(error: z.ZodError): string {
    const [first] = error.issues;
    if (first === undefined) return "(root): invalid";
    return `${first.path.join(".") || "(root)"}: ${first.code}`;
}
