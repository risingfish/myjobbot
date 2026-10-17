import { lookUpCareers, type CareersDeps, type CareersSummary } from "../careers/lookUpJobs.js";
import type { SoughtJob } from "../careers/session.js";
import type { JobRow } from "../db/store.js";
import { ALERTS_SOURCE } from "../gmail/alertJobs/source.js";
import type { ToolContext } from "./context.js";
import { unscoredJobs } from "./unscored.js";

const BYTES_PER_KB = 1024;

/** Looks up careers-page descriptions for the alert jobs that still lack one and haven't been looked up before. */
export async function lookUpAlertJobs(context: ToolContext): Promise<CareersSummary> {
    const missing = (await unscoredJobs(context, ALERTS_SOURCE, { seen: null, note: null })).filter((row) => row.description === null);
    const done = await context.careers.store.attempted(missing.map((row) => ({ ats: row.ats, jobId: row.job_id })));
    const fresh = missing.filter((row) => !done.some((key) => key.ats === row.ats && key.jobId === row.job_id));
    const sought = fresh.sort((left, right) => left.first_seen.localeCompare(right.first_seen)).map(soughtJob);
    return lookUpCareers(careersDeps(context), sought);
}

/** Describes a stored job as the lookup's input: only its key, title, company and location. */
function soughtJob(row: JobRow): SoughtJob {
    return { ats: row.ats, jobId: row.job_id, title: row.title, company: row.company, location: row.location };
}

/** Gathers what the careers lookup needs from the run's context, so src/careers never reads the tool context. */
function careersDeps(context: ToolContext): CareersDeps {
    const { careers, config } = context;
    const pages = { pages: careers.pages, lookup: careers.lookup, maxBytes: config.careers_lookup.max_download_kb * BYTES_PER_KB };
    return { chat: context.chat, trace: context.trace, settings: config.careers_lookup, pages, jobs: context.store, careers: careers.store, runId: context.runId, now: context.now, http: context.http, searxngUrl: careers.searxngUrl };
}
