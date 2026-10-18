import { LinkRegistry } from "./registry.js";

export interface SoughtJob {
    ats: string;
    jobId: string;
    title: string;
    company: string;
    location: string | null;
    retry?: boolean;
}

export const MODEL_REASONS = ["no_careers_page", "careers_page_unreadable", "job_not_found", "job_page_unreadable"] as const;

type ModelReason = (typeof MODEL_REASONS)[number];

export type LookupReason = ModelReason | "fetch_refused" | "timed_out" | "gave_up" | "lookup_error";

export interface LookupSession {
    job: SoughtJob;
    registry: LinkRegistry;
    opens: number;
    searched: number | null;
    resultUrls: string[];
    remembered: string | null;
    lastOpened: "careers" | "job" | null;
    careersPage: { url: string; links: number } | null;
    jobPage: { url: string; text: string } | null;
    lastFailure: "fetch_refused" | "timed_out" | null;
    finished: { found: boolean; reason: ModelReason | null } | null;
    overLimit: boolean;
    stop: Error | null;
}

/** Starts the state one job's lookup conversation keeps: the links offered, the pages opened, and how it ended. */
export function newSession(job: SoughtJob): LookupSession {
    return { job, registry: new LinkRegistry(), opens: 0, searched: null, resultUrls: [], remembered: null, lastOpened: null, careersPage: null, jobPage: null, lastFailure: null, finished: null, overLimit: false, stop: null };
}

/** Tells whether a page's text has anything in it besides whitespace. */
export function hasText(text: string): boolean {
    return text.trim() !== "";
}
