import type { FormEvent } from "react";
import type { JobRowView } from "../../src/web/api.js";
import { setJobApplied } from "./actions.js";
import { appliedRequest } from "./appliedRequest.js";
import { useSave } from "./useSave.js";

/** Marks a job applied, or undoes the mark once the owner confirms, when its form is submitted, tracking whether the change is saving or failed. */
export function useApplied(job: JobRowView, onApplied: (appliedOn: string | null) => void) {
    const request = appliedRequest(job);
    const save = useSave(
        () => setJobApplied(request.ats, request.jobId, request.applied),
        (result) => onApplied(result.appliedOn),
    );
    const submit = async (event: FormEvent) => {
        if (request.confirm === null || confirm(request.confirm)) return save.submit(event);
        event.preventDefault();
    };
    return { status: save.status, submit };
}
