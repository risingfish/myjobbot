import { lookUpCareers, type CareersDeps, type CareersSummary } from "../careers/lookUpJobs.js";
import type { SoughtJob } from "../careers/session.js";
import type { JobRow } from "../db/store.js";
import { ALERTS_SOURCE } from "../gmail/alertJobs/source.js";
import type { ToolContext } from "./context.js";
import { isWanted, unscoredJobs } from "./unscored.js";

const BYTES_PER_KB = 1024;

/** Looks up careers-page descriptions for the alert jobs that still lack one: new ones, and earlier unreadable ones owed a retry. */
export async function lookUpAlertJobs(context: ToolContext): Promise<CareersSummary> {
    const retried = await retriedJobs(context);
    const fresh = (await freshJobs(context)).filter((row) => !retried.some((other) => sameJob(other, row)));
    const rows = [...fresh.map((row) => ({ row, retry: false })), ...retried.map((row) => ({ row, retry: true }))];
    const sought = rows.sort((left, right) => left.row.first_seen.localeCompare(right.row.first_seen)).map(soughtJob);
    return lookUpCareers(careersDeps(context), sought);
}

/** Lists the unscored alert jobs with no description that haven't been looked up before. */
async function freshJobs(context: ToolContext): Promise<JobRow[]> {
    const missing = (await unscoredJobs(context, ALERTS_SOURCE, { seen: null, note: null })).filter((row) => row.description === null);
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

/** Describes a stored job as the lookup's input: its key, title, company and location, and whether it is a retry. */
function soughtJob({ row, retry }: { row: JobRow; retry: boolean }): SoughtJob {
    const job = { ats: row.ats, jobId: row.job_id, title: row.title, company: row.company, location: row.location };
    return retry ? { ...job, retry } : job;
}

/** Gathers what the careers lookup needs from the run's context, so src/careers never reads the tool context. */
function careersDeps(context: ToolContext): CareersDeps {
    const { careers, config } = context;
    const pages = { pages: careers.pages, lookup: careers.lookup, maxBytes: config.careers_lookup.max_download_kb * BYTES_PER_KB };
    return { chat: context.chat, trace: context.trace, settings: config.careers_lookup, pages, jobs: context.store, careers: careers.store, runId: context.runId, now: context.now, http: context.http, boardHttp: careers.boards, searxngUrl: careers.searxngUrl };
}
