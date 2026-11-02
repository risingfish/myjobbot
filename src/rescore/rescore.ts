import type { ChatFn } from "../agent/llm.js";
import type { DataMarkers } from "../agent/markers.js";
import type { Trace } from "../agent/trace.js";
import { soughtJob } from "../careers/deps.js";
import type { SoughtJob } from "../careers/session.js";
import type { AppConfig } from "../config/load.js";
import type { JobKey, JobRow, JobStore, JobViews } from "../db/store.js";
import { describeError } from "../errors.js";
import { FILTER_NOTES } from "../jobs/filterMatch.js";
import { rescoreStep, type RescoreStep } from "./plan.js";
import { scoreOne } from "./session.js";

export interface RescoreDeps {
    config: AppConfig;
    store: JobStore;
    views: JobViews;
    chat: ChatFn;
    trace: Trace;
    runId: string;
    now: () => Date;
    lookUp: (job: SoughtJob) => Promise<unknown>;
    markers: DataMarkers;
}

export type RescoreOutcome = { outcome: "scored" } | { outcome: "filtered"; note: string } | { outcome: "failed" };

const FAILED: RescoreOutcome = { outcome: "failed" };

/** Scores one job again at once from its current description and settings, clearing its score when a filter now hides it; a failure keeps the old score. */
export async function rescore(deps: RescoreDeps, key: JobKey): Promise<RescoreOutcome> {
    deps.trace.write({ type: "rescore", ats: key.ats, job_id: key.jobId });
    try {
        return await rescoreKnown(deps, key);
    } catch (error) {
        deps.trace.write({ type: "rescore_failed", error: describeError(error) });
        return FAILED;
    }
}

/** Follows the plan for a job that exists: clears a filtered job's score, or scores it in a one-job session. */
async function rescoreKnown(deps: RescoreDeps, key: JobKey): Promise<RescoreOutcome> {
    const step = await plannedStep(deps, key);
    if (step.kind === "filtered") {
        await deps.views.clearScore(key);
        return { outcome: "filtered", note: FILTER_NOTES[step.by] };
    }
    return (await scoreOne({ ...deps, key })) ? { outcome: "scored" } : FAILED;
}

/** Plans the job's re-score, looking up a missing description once and planning again with what the lookup stored. */
async function plannedStep(deps: RescoreDeps, key: JobKey): Promise<RescoreStep> {
    const first = rescoreStep(await readJob(deps, key), deps.config.settings, { lookedUp: false });
    if (first.kind !== "lookup") return first;
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
    }
}
