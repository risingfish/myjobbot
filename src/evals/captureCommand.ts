import { parseArgs } from "node:util";
import type { AppConfig } from "../config/load.js";
import type { JobKey, JobRow } from "../db/store.js";
import type { UserStores } from "../db/userStores.js";
import { jobDetails } from "../tools/getJobDetails.js";
import { asScoredDates, buildCase, profileOf } from "./capture.js";
import type { EvalCase } from "./format.js";
import type { EvalFiles } from "./files.js";
import type { FilePort } from "./filePort.js";
import { caseId } from "./ids.js";
import { observedRead, traceOf } from "./observedRead.js";

const USAGE = "usage: myjobbot eval capture <ats> <job_id> | --recent <N> [--tag t]... [--fresh] [--user <email>]";
const NOTE = "note: observed scores used the resume and preferences of their time; cases use today's";
const MAX_RECENT = 200;

export interface CaptureDeps {
    stores: Pick<UserStores, "userId" | "jobStore" | "jobViews" | "careers" | "postings">;
    files: EvalFiles;
    port: FilePort;
    config: AppConfig;
    now: () => Date;
    print: (line: string) => void;
}

interface Capture {
    deps: CaptureDeps;
    capturedAt: string;
    profile: ReturnType<typeof profileOf>;
    tags: string[];
    fresh: boolean;
}

interface Outcome {
    line: string;
    observed?: boolean;
    failed?: boolean;
}

/** Freezes stored jobs, named by key or the most recently scored, as eval cases, printing a line per job; only reads the database. */
export async function captureCases(args: string[], deps: CaptureDeps): Promise<number> {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { recent: { type: "string" }, tag: { type: "string", multiple: true }, fresh: { type: "boolean" } } });
    const keys = await keysFrom(values.recent, positionals, deps);
    if (keys === null) return printed(deps, [USAGE], 2);
    const capturedAt = deps.now().toISOString();
    const capture: Capture = { deps, capturedAt, profile: profileOf(deps.config, capturedAt), tags: values.tag ?? [], fresh: values.fresh === true };
    const outcomes: Outcome[] = [];
    for (const key of keys) outcomes.push(await captureOne(capture, key));
    const lines = [...outcomes.map((outcome) => outcome.line), ...(outcomes.some((outcome) => outcome.observed) ? [NOTE] : [])];
    return printed(deps, lines, outcomes.some((outcome) => outcome.failed) ? 1 : 0);
}

/** Picks the jobs to capture: one by its key, or the N most recently scored; null when the arguments name neither. */
async function keysFrom(recent: string | undefined, positionals: string[], deps: CaptureDeps): Promise<JobKey[] | null> {
    if (recent === undefined) return positionals.length === 2 ? [{ ats: positionals[0] ?? "", jobId: positionals[1] ?? "" }] : null;
    const limit = Number(recent);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RECENT || positionals.length > 0) return null;
    return deps.stores.jobViews.recentlyScored(limit);
}

/** Captures one job, unless it is unknown or already has a case that isn't to be replaced. */
async function captureOne(capture: Capture, key: JobKey): Promise<Outcome> {
    const row = await capture.deps.stores.jobStore.findJob(key.jobId);
    if (row === null || row.ats !== key.ats) return { line: `unknown job ${key.ats} ${key.jobId}`, failed: true };
    const id = caseId(key.ats, key.jobId);
    if (!capture.fresh && (await capture.deps.files.hasCase(id))) return { line: `exists: ${id}` };
    const built = buildCase(await caseInput(capture, key, row));
    if (!built.ok) return { line: `not captured ${id}: ${built.problem}`, failed: true };
    await capture.deps.files.writeProfile(capture.profile.id, capture.profile.profile);
    await capture.deps.files.writeCase(built.value);
    return { line: capturedLine(built.value), observed: built.value.observed !== null };
}

/** Gathers what a job's case is built from: its payload, its latest score, its age, how much of it was read, and when its description arrived. */
async function caseInput(capture: Capture, key: JobKey, row: JobRow) {
    const { stores, port, config } = capture.deps;
    const [verdict = null] = await stores.jobViews.jobVerdicts(key);
    const payload = await jobDetails({ store: stores.jobStore, postings: stores.postings, now: () => new Date(capture.capturedAt), config: config.settings }, key.jobId);
    const earliestSeen = await stores.postings.earliestSeen(row.company, row.normalized_title);
    const dates = asScoredDates({ earliestSeen, capturedAt: capture.capturedAt, scoredAt: verdict?.scored_at ?? null, ghostThresholdDays: config.settings.ghost_threshold_days });
    const read = verdict === null ? ("unknown" as const) : observedRead(await traceOf(port, verdict.run_id), key.jobId);
    const descriptionFoundAt = row.description_source === "careers" ? await stores.careers.descriptionFoundAt(key) : null;
    return { source: key, title: row.title, company: row.company, payload, dates, verdict, read, descriptionFoundAt, profile: capture.profile.id, tags: capture.tags, userId: stores.userId };
}

/** Says what was captured: the score and how it was read with the age as scored, or that the job was never scored. */
function capturedLine(value: EvalCase): string {
    const { id, observed, dates } = value;
    if (observed === null) return `captured ${id} · never scored · ${days(dates.daysOpenAtCapture)} open`;
    const changed = value.descriptionChangedSinceScored ? " · description found after the score" : "";
    return `captured ${id} · scored ${observed.score} (${observed.read}) · ${days(dates.daysOpenAsScored)} as scored (shift ${dates.shiftedDays})${changed}`;
}

/** Writes a count of days, singular for one. */
function days(count: number): string {
    return count === 1 ? "1 day" : `${count} days`;
}

/** Prints lines and gives back an exit code. */
function printed(deps: CaptureDeps, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}
