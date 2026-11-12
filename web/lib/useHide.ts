import type { JobRowView } from "../../src/web/api.js";
import { setJobHidden } from "./actions.js";
import { confirmedSubmit, useSave } from "./useSave.js";

/** Hides or unhides a job on the server when its form is submitted, after the owner confirms when there is a question to ask, tracking whether the change is saving or failed. */
export function useHide(job: JobRowView, onHidden: (hidden: boolean) => void, question: string | null = null) {
    const save = useSave(
        () => setJobHidden(job.ats, job.jobId, !job.hidden),
        () => onHidden(!job.hidden),
    );
    return { status: save.status, submit: confirmedSubmit(question, save.submit) };
}
