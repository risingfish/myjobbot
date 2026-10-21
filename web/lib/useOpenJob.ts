import { useSearchParams } from "next/navigation.js";
import { useState } from "react";
import type { JobKey } from "../../src/db/store.js";
import type { JobRowView } from "../../src/web/api.js";
import { jobIn, withJob } from "./jobParam.js";

/** Reads which job the page address has open, with ways to open another or close it that keep the address in step. */
export function useOpenJob() {
    const params = useSearchParams();
    const text = params?.toString() ?? "";
    return { key: jobIn(params), search: text === "" ? "" : `?${text}`, open: openJob, close: closeJob };
}

/** Puts a job in the page address, adding a history entry. */
function openJob(key: JobKey): void {
    history.pushState(null, "", withJob(location.search, key));
}

/** Takes the job out of the page address, adding a history entry only when the address still names one. */
function closeJob(): void {
    if (jobIn(new URLSearchParams(location.search)) !== null) history.pushState(null, "", withJob(location.search, null));
}

/** Tells whether a row is the job a key names. */
function isJob(job: JobRowView, key: JobKey | null): boolean {
    return key !== null && job.ats === key.ats && job.jobId === key.jobId;
}

/** Picks the row the panel shows, keeping it after it leaves the list (hidden on Recommended) and noting its hidden state. */
export function usePanelJob(rows: JobRowView[], key: JobKey | null) {
    const listed = rows.find((row) => isJob(row, key)) ?? null;
    const [kept, setKept] = useState<JobRowView | null>(null);
    if (listed !== null && listed !== kept) setKept(listed);
    const noteHidden = (job: JobRowView, hidden: boolean) => setKept((current) => (current !== null && isJob(current, job) ? { ...current, hidden } : current));
    return { job: listed ?? (kept !== null && isJob(kept, key) ? kept : null), noteHidden };
}
