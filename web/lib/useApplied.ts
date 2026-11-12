import type { JobRowView } from "../../src/web/api.js";
import { setJobApplied } from "./actions.js";
import { appliedRequest } from "./appliedRequest.js";
import { confirmedSubmit, useSave } from "./useSave.js";

/** Marks a job applied, or undoes the mark once the owner confirms, when its form is submitted, tracking whether the change is saving or failed. */
export function useApplied(job: JobRowView, onApplied: (appliedOn: string | null) => void) {
    const request = appliedRequest(job);
    const save = useSave(
        () => setJobApplied(request.ats, request.jobId, request.applied),
        (result) => onApplied(result.appliedOn),
    );
    return { status: save.status, submit: confirmedSubmit(request.confirm, save.submit) };
}
