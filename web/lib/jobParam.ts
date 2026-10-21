import type { JobKey } from "../../src/db/store.js";

const PARAM = "job";

/** Reads the job a page address names, as board and job id, or null when it names none. */
function parseJobParam(value: string | null): JobKey | null {
    if (value === null) return null;
    const colon = value.indexOf(":");
    const key = { ats: value.slice(0, colon), jobId: value.slice(colon + 1) };
    return colon > 0 && key.jobId !== "" ? key : null;
}

/** Writes a job's key as it appears in the page address. */
export function jobParam(key: JobKey): string {
    return `${key.ats}:${key.jobId}`;
}

/** Returns a query string naming the given job, or naming none, with every other parameter kept. */
export function withJob(search: string, key: JobKey | null): string {
    const params = new URLSearchParams(search);
    if (key === null) params.delete(PARAM);
    else params.set(PARAM, jobParam(key));
    return `?${params.toString()}`;
}

/** Reads the job named by a query string's job parameter. */
export function jobIn(params: Pick<URLSearchParams, "get"> | null): JobKey | null {
    return parseJobParam(params?.get(PARAM) ?? null);
}
