import type { JobRowView } from "../../src/web/api.js";
import type { usePanelJob } from "./useOpenJob.js";
import type { PageRows } from "./usePageRows.js";

type PanelJob = ReturnType<typeof usePanelJob>;

/** Applies a job's saved changes and re-scores to both the listed rows and the details panel showing it, closing the panel after a hide made from it. */
export function useJobChanges(rows: PageRows, panel: PanelJob, close: () => void) {
    const markHidden = (job: JobRowView, hidden: boolean) => {
        rows.markHidden(job, hidden);
        panel.noteChange(job, { hidden });
    };
    const markApplied = (job: JobRowView, appliedOn: string | null) => {
        rows.markApplied(job, appliedOn);
        panel.noteChange(job, { applied: appliedOn !== null, appliedOn });
    };
    const hideFromPanel = (job: JobRowView) => {
        markHidden(job, true);
        close();
    };
    const markRescored = (job: JobRowView, row: JobRowView) => {
        rows.replaceRow(row);
        panel.noteChange(job, row);
    };
    return { markHidden, markApplied, hideFromPanel, markRescored };
}
