import type { ChatFn } from "../agent/llm.js";
import type { DataMarkers } from "../agent/markers.js";
import type { Trace } from "../agent/trace.js";
import type { Settings } from "../config/schema.js";
import type { CareersStore, JobRow, JobStore } from "../db/store.js";
import type { JsonGetter, JsonPoster, TextGetter } from "../http/client.js";
import type { HostLookup } from "./fetchPage.js";
import type { CareersDeps } from "./lookUpJobs.js";
import type { PageRenderer } from "./renderState.js";
import type { SoughtJob } from "./session.js";

const BYTES_PER_KB = 1024;

export interface CareersAccess {
    store: CareersStore;
    searxngUrl: string | null;
    lookup: HostLookup;
    pages: TextGetter;
    boards: JsonGetter & JsonPoster;
    renderer: PageRenderer;
}

export interface CareersParts {
    careers: CareersAccess;
    settings: Settings["careers_lookup"];
    chat: ChatFn;
    trace: Trace;
    jobs: JobStore;
    runId: string;
    now: () => Date;
    http: JsonGetter;
    markers: DataMarkers;
}

/** Gathers what the careers lookup needs from plain parts, so src/careers never reads the tool context. */
export function careersDeps({ careers, settings, ...rest }: CareersParts): CareersDeps {
    const pages = { pages: careers.pages, lookup: careers.lookup, maxBytes: settings.max_download_kb * BYTES_PER_KB };
    return { ...rest, settings, pages, careers: careers.store, boardHttp: careers.boards, renderer: careers.renderer, searxngUrl: careers.searxngUrl };
}

/** Describes a stored job as the lookup's input: its key, title, company and location, and whether it is a retry. */
export function soughtJob({ row, retry }: { row: JobRow; retry: boolean }): SoughtJob {
    const job = { ats: row.ats, jobId: row.job_id, title: row.title, company: row.company, location: row.location };
    return retry ? { ...job, retry } : job;
}
