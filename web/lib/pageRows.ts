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

const LISTS: Record<PageName, (row: JobRowView) => boolean> = {
    recommended: (row) => !row.hidden && !row.applied && row.score !== null,
    applied: (row) => row.applied,
    jobs: () => true,
    reasoning: () => true,
};

const OFFERS_HIDE: Record<PageName, boolean> = { recommended: true, applied: true, jobs: false, reasoning: false };

/** Says whether a page's rows offer Hide; All jobs lists every job, hidden ones too, so it doesn't. */
export function offersHide(page: PageName): boolean {
    return OFFERS_HIDE[page];
}

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
function withoutJob(key: string): RowsChange {
    return (data) => {
        if (data.kind !== "jobs") return data;
        const nextOffset = data.nextOffset === null ? null : data.nextOffset - 1;
        return { ...data, rows: data.rows.filter((job) => jobKey(job) !== key), total: data.total - 1, nextOffset };
    };
}

/** Builds the change for a job's hidden mark: it updates the row, except on a page the job no longer belongs on, such as Recommended once hidden. */
export function hiddenChange(job: JobRowView, hidden: boolean, page: PageName): { change: RowsChange; removing: boolean } {
    return changed(page, job, { hidden });
}

/** Builds the change for a re-scored job: its new row replaces the listed one, except on a page it no longer belongs on, such as Recommended when left with no score. */
export function rescoredChange(row: JobRowView, page: PageName): { change: RowsChange; removing: boolean } {
    return changed(page, row, row);
}

/** Builds the change for a job's applied mark: it updates the row, except where the job no longer belongs, dropping it from Recommended once marked and from Applied once cleared. */
export function appliedChange(job: JobRowView, appliedOn: string | null, page: PageName): { change: RowsChange; removing: boolean } {
    return changed(page, job, { applied: appliedOn !== null, appliedOn });
}

/** Applies some of a job's fields to its row, or drops the row when the page's list no longer takes the changed job. */
function changed(page: PageName, job: JobRowView, fields: Partial<JobRowView>): { change: RowsChange; removing: boolean } {
    const removing = !LISTS[page]({ ...job, ...fields });
    return { change: removing ? withoutJob(jobKey(job)) : withJobFields(jobKey(job), fields), removing };
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
