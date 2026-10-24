import type { JobRowView } from "../../src/web/api.js";
import { setJobHidden } from "./actions.js";
import { useSave } from "./useSave.js";

/** Hides or unhides a job on the server when its form is submitted, tracking whether the change is saving or failed. */
export function useHide(job: JobRowView, onHidden: (hidden: boolean) => void) {
    return useSave(
        () => setJobHidden(job.ats, job.jobId, !job.hidden),
        () => onHidden(!job.hidden),
    );
}
