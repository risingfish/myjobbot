import type { ChatFn } from "../agent/llm.js";
import type { DataMarkers } from "../agent/markers.js";
import type { Trace } from "../agent/trace.js";
import { soughtJob } from "../careers/deps.js";
import type { SoughtJob } from "../careers/session.js";
import type { PostingStore } from "../db/postingStore.js";
import type { AppConfig } from "../config/load.js";
import type { RescoreEnd } from "../db/rescoreLogStore.js";
import type { JobKey } from "../db/store.js";
import type { JobRow, JobStore } from "../db/jobStore.js";
import type { JobViews } from "../db/jobViews.js";
import { describeError } from "../errors.js";
import { FILTER_NOTES } from "../jobs/filterMatch.js";
import type { RescoreLog } from "./log.js";
import { rescoreStep, type RescoreStep } from "./plan.js";
import { scoreOne } from "./session.js";

export interface RescoreDeps {
    config: AppConfig;
    store: JobStore;
    postings: PostingStore;
    views: JobViews;
    chat: ChatFn;
    trace: Trace;
    runId: string;
    now: () => Date;
    lookUp: (job: SoughtJob) => Promise<unknown>;
    markers: DataMarkers;
    log: Pick<RescoreLog, "step" | "end">;
    fallbacks: number;
}

export type RescoreOutcome = { outcome: "scored" } | { outcome: "filtered"; note: string } | { outcome: "failed" };

const FAILED: RescoreEnd = { outcome: "failed", filter: null, score: null };

/** Scores one job again at once from its current description and settings, clearing its score when a filter now hides it; a failure keeps the old score. Every step is logged, and the run ends with its outcome. */
export async function rescore(deps: RescoreDeps, key: JobKey): Promise<RescoreOutcome> {
    deps.trace.write({ type: "rescore", ats: key.ats, job_id: key.jobId });
    deps.log.step({ kind: "settings", fields: { fallbacks: deps.fallbacks } });
    const end = await endOf(deps, key);
    deps.log.step({ kind: "outcome", fields: end });
    await deps.log.end(end);
    return outcomeOf(end);
}

/** Runs the re-score to its end, tracing any failure and ending failed. */
async function endOf(deps: RescoreDeps, key: JobKey): Promise<RescoreEnd> {
    try {
        return await rescoreKnown(deps, key);
    } catch (error) {
        deps.trace.write({ type: "rescore_failed", error: describeError(error) });
        return FAILED;
    }
}

/** Follows the plan for a job that exists: logs which filter, if any, hides it, then clears a filtered job's score or scores it in a one-job session. */
async function rescoreKnown(deps: RescoreDeps, key: JobKey): Promise<RescoreEnd> {
    const step = await plannedStep(deps, key);
    deps.log.step({ kind: "filters", fields: { by: step.kind === "filtered" ? step.by : null } });
    if (step.kind === "filtered") {
        await deps.views.clearScore(key);
        return { outcome: "filtered", filter: step.by, score: null };
    }
    const score = await scoreOne({ ...deps, key });
    return score === null ? FAILED : { outcome: "scored", filter: null, score };
}

/** Turns how a run ended into the outcome its callers act on. */
function outcomeOf(end: RescoreEnd): RescoreOutcome {
    if (end.outcome === "scored") return { outcome: "scored" };
    return end.outcome === "filtered" && end.filter !== null ? { outcome: "filtered", note: FILTER_NOTES[end.filter] } : { outcome: "failed" };
}

/** Plans the job's re-score, looking up a missing description once and planning again with what the lookup stored. */
async function plannedStep(deps: RescoreDeps, key: JobKey): Promise<RescoreStep> {
    const first = rescoreStep(await readJob(deps, key), deps.config.settings, { lookedUp: false });
    if (first.kind !== "lookup") return first;
    deps.log.step({ kind: "lookup", fields: {} });
    await lookUpOnce(deps, await readJob(deps, key));
    return rescoreStep(await readJob(deps, key), deps.config.settings, { lookedUp: true });
}

/** Reads the job to re-score, refusing one that doesn't exist under this key. */
async function readJob(deps: RescoreDeps, key: JobKey): Promise<JobRow> {
    const row = await deps.store.findJob(key.jobId);
    if (row === null || row.ats !== key.ats) throw new Error("unknown job");
    return row;
}

/** Looks up a job's missing description, tracing a failed lookup without failing the re-score, which then scores from what it has. */
async function lookUpOnce(deps: RescoreDeps, row: JobRow): Promise<void> {
    try {
        await deps.lookUp(soughtJob({ row, retry: false }));
    } catch (error) {
        deps.trace.write({ type: "rescore_lookup_failed", error: describeError(error) });
        deps.log.step({ kind: "lookup_failed", fields: {} });
    }
}
