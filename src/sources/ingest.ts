import type { JobSource } from "../db/jobSource.js";
import type { JobStore } from "../db/store.js";
import { normalizeCompany } from "../jobs/company.js";
import { isExcludedPublisher } from "../jobs/companyFilter.js";
import type { Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";
import type { ToolContext } from "../tools/context.js";
import type { SourceModule, SourcePage } from "./module.js";

interface IngestBatch {
    source: JobSource;
    scope: SourceModule<unknown>["scope"];
    seen: string;
}

export interface Ingested {
    stored: Job[];
    skippedPublishers: number;
    skippedCopies: number;
}

/** Stores one fetched page under its source; a query source's results first lose excluded publishers and copies of jobs a company source already supplied. */
async function ingest(context: Pick<ToolContext, "store" | "config">, batch: IngestBatch, page: SourcePage): Promise<Ingested> {
    const query = batch.scope === "query";
    const wanted = query ? page.jobs.filter((job) => !isExcludedPublisher(job, context.config.jsearch.exclude_publishers)) : page.jobs;
    const stored = query ? await withoutBoardCopies(context.store, wanted) : wanted;
    await context.store.upsertAll(stored, batch.seen, batch.source);
    return { stored, skippedPublishers: page.jobs.length - wanted.length, skippedCopies: wanted.length - stored.length };
}

/** Returns the jobs no company board already supplied. */
async function withoutBoardCopies(store: JobStore, jobs: Job[]): Promise<Job[]> {
    const copies = await Promise.all(jobs.map((job) => hasBoardCopy(store, job)));
    return jobs.filter((_, index) => !copies[index]);
}

/** Reports whether a company board already supplied a job with this company and title. */
async function hasBoardCopy(store: JobStore, job: Job): Promise<boolean> {
    const company = normalizeCompany(job.company);
    const boardCompanies = await store.boardCompaniesWithTitle(normalizeTitle(job.title));
    return boardCompanies.some((name) => normalizeCompany(name) === company);
}

interface ModuleFetch {
    module: SourceModule<unknown>;
    params: unknown;
    batch: IngestBatch & { name: string };
}

/** Reads every page a source's module yields, through the run's checked client, and stores each one as it arrives. */
export async function fetchAndIngest(context: Pick<ToolContext, "store" | "config" | "sources" | "jsearchApiKey">, { module, params, batch }: ModuleFetch): Promise<Ingested> {
    const jsearch = context.jsearchApiKey === null ? {} : { jsearch: { apiKey: context.jsearchApiKey, settings: context.config.jsearch } };
    const total: Ingested = { stored: [], skippedPublishers: 0, skippedCopies: 0 };
    for await (const page of module.fetch(params, { http: context.sources, sourceName: batch.name, ...jsearch }, null)) {
        const ingested = await ingest(context, batch, page);
        total.stored.push(...ingested.stored);
        total.skippedPublishers += ingested.skippedPublishers;
        total.skippedCopies += ingested.skippedCopies;
    }
    return total;
}
