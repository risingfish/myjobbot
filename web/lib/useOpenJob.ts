import { useSearchParams } from "next/navigation.js";
import { useState } from "react";
import type { JobKey } from "../../src/db/store.js";
import type { JobRowView } from "../../src/web/api.js";
import { jobIn, jobParam, withJob } from "./jobParam.js";

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

/** Keeps the last job opened after the panel closes, so the panel still shows it as it slides out. */
function useShownJob(key: JobKey | null): JobKey | null {
    const [last, setLast] = useState<JobKey | null>(null);
    if (key !== null && (last === null || jobParam(last) !== jobParam(key))) setLast(key);
    return key ?? last;
}

/** Tells whether a row is the job a key names. */
function isJob(job: JobRowView, key: JobKey | null): boolean {
    return key !== null && job.ats === key.ats && job.jobId === key.jobId;
}

/** Picks the job the panel shows and its row, keeping both after the panel closes or the row leaves the list (hidden on Recommended), and noting its hidden state. */
export function usePanelJob(rows: JobRowView[], open: JobKey | null) {
    const key = useShownJob(open);
    const listed = rows.find((row) => isJob(row, key)) ?? null;
    const [kept, setKept] = useState<JobRowView | null>(null);
    if (listed !== null && listed !== kept) setKept(listed);
    const noteHidden = (job: JobRowView, hidden: boolean) => setKept((current) => (current !== null && isJob(current, job) ? { ...current, hidden } : current));
    return { shown: key, job: listed ?? (kept !== null && isJob(kept, key) ? kept : null), noteHidden };
}
