import type { JobRowView, PageData, PageName } from "../../src/web/api.js";

export interface LoadedPage {
    data: PageData | null;
    error: string | null;
}

export interface RowsState extends LoadedPage {
    moreError: string | null;
    version: number;
}

export type RowsChange = (data: PageData) => PageData;

/** Returns the key that identifies a job row across pages and reloads. */
export function jobKey(job: JobRowView): string {
    return `${job.ats}:${job.jobId}`;
}

/** Adds a further page of rows to those shown, records why it failed, or drops it if rows were removed while it loaded. */
export function withMore(current: RowsState, more: LoadedPage, requestedAt: number): RowsState {
    if (current.version !== requestedAt) return current;
    if (more.data === null || current.data === null) return { ...current, moreError: more.error };
    return { ...current, data: appendPage(current.data, more.data), moreError: null };
}

/** Builds the change that drops a job from the rows shown, so later pages still start at the right row. */
export function withoutJob(key: string): RowsChange {
    return (data) => {
        if (data.kind !== "jobs") return data;
        const nextOffset = data.nextOffset === null ? null : data.nextOffset - 1;
        return { ...data, rows: data.rows.filter((job) => jobKey(job) !== key), total: data.total - 1, nextOffset };
    };
}

/** Builds the change that marks a job as hidden or shown again. */
export function withJobHidden(key: string, hidden: boolean): RowsChange {
    return withJobFields(key, { hidden });
}

/** Builds the change that marks a job applied at a time, or clears its mark when the time is null. */
export function withJobApplied(key: string, appliedOn: string | null): RowsChange {
    return withJobFields(key, { applied: appliedOn !== null, appliedOn });
}

/** Builds the change for a re-scored job: its new row replaces the listed one, except on Recommended, where a job left with no score is dropped. */
export function rescoredChange(row: JobRowView, page: PageName): { change: RowsChange; removing: boolean } {
    const removing = page === "recommended" && row.score === null;
    return { change: removing ? withoutJob(jobKey(row)) : withJobFields(jobKey(row), row), removing };
}

/** Builds the change that updates some of one job's fields in the rows shown. */
function withJobFields(key: string, fields: Partial<JobRowView>): RowsChange {
    return (data) => {
        if (data.kind !== "jobs") return data;
        return { ...data, rows: data.rows.map((job) => (jobKey(job) === key ? { ...job, ...fields } : job)) };
    };
}

/** Appends a further page of rows of the same kind, skipping any already shown, and keeps the newer page's totals. */
function appendPage(current: PageData, more: PageData): PageData {
    if (current.kind === "jobs" && more.kind === "jobs") return { ...more, rows: [...current.rows, ...unseen(current.rows, more.rows, jobKey)] };
    if (current.kind === "verdicts" && more.kind === "verdicts") {
        return { ...more, rows: [...current.rows, ...unseen(current.rows, more.rows, (verdict) => verdict.key)] };
    }
    return current;
}

/** Returns the rows not already shown, since new rows at the top of the list push earlier ones onto the next page. */
function unseen<T>(shown: T[], more: T[], key: (row: T) => string): T[] {
    const seen = new Set(shown.map(key));
    return more.filter((row) => !seen.has(key(row)));
}
