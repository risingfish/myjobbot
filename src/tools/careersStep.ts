import { careersDeps, soughtJob, type CareersParts } from "../careers/deps.js";
import { lookUpCareers, type CareersSummary } from "../careers/lookUpJobs.js";
import type { JobRow } from "../db/store.js";
import type { ToolContext } from "./context.js";
import { isWanted, unscoredJobs } from "./unscored.js";

/** Looks up careers-page descriptions for the alert jobs that still lack one: new ones, and earlier unreadable ones owed a retry. */
export async function lookUpAlertJobs(context: ToolContext): Promise<CareersSummary> {
    const retried = await retriedJobs(context);
    const fresh = (await freshJobs(context)).filter((row) => !retried.some((other) => sameJob(other, row)));
    const rows = [...fresh.map((row) => ({ row, retry: false })), ...retried.map((row) => ({ row, retry: true }))];
    const sought = rows.sort((left, right) => left.row.first_seen.localeCompare(right.row.first_seen)).map(soughtJob);
    return lookUpCareers(careersDeps(careersParts(context)), sought);
}

/** Lists the unscored alert jobs with no description that haven't been looked up before. */
async function freshJobs(context: ToolContext): Promise<JobRow[]> {
    const alerts = context.saved.list.find((source) => source.module === "gmail_alerts");
    if (alerts === undefined) return [];
    const missing = (await unscoredJobs(context, alerts)).filter((row) => row.description === null);
    const done = await context.careers.store.attempted(missing.map((row) => ({ ats: row.ats, jobId: row.job_id })));
    return missing.filter((row) => !done.some((key) => key.ats === row.ats && key.jobId === row.job_id));
}

/** Lists the jobs still owed a retry that still lack a description, scored or not; only alert jobs are ever looked up, so only they are owed one. */
async function retriedJobs(context: ToolContext): Promise<JobRow[]> {
    const keys = await context.careers.store.retries();
    const rows = await Promise.all(keys.map(async (key) => ({ key, row: await context.store.findJob(key.jobId) })));
    return rows.flatMap(({ key, row }) => (row !== null && row.ats === key.ats && row.description === null && isWanted(row, context.config) ? [row] : []));
}

/** Tells whether two stored rows are the same job. */
function sameJob(left: JobRow, right: JobRow): boolean {
    return left.ats === right.ats && left.job_id === right.job_id;
}

/** Gathers the careers lookup's parts from the run's context. */
function careersParts(context: ToolContext): CareersParts {
    return { careers: context.careers, settings: context.config.careers_lookup, chat: context.chat, trace: context.trace, jobs: context.store, runId: context.runId, now: context.now, http: context.http, markers: context.markers };
}
