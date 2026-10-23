import type { JobRowView } from "../../src/web/api.js";

/** Decides what the panel's Applied area shows: the button that marks the job, or the done state that undoes the mark. */
export function panelApplied(job: Pick<JobRowView, "applied">): "offer" | "done" {
    return job.applied ? "done" : "offer";
}

/** Decides whether the panel's Hide can be used: not for a job already hidden, which only its row can bring back. */
export function panelHide(job: Pick<JobRowView, "hidden">): "enabled" | "disabled" {
    return job.hidden ? "disabled" : "enabled";
}
