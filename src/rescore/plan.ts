import type { Settings } from "../config/schema.js";
import type { JobRow } from "../db/store.js";
import { filterMatch, filterSet } from "../jobs/filterMatch.js";

export type RescoreStep = { kind: "filtered"; by: "company" | "title" | "body" } | { kind: "lookup" } | { kind: "score" };

/** Decides a re-score's next step: drop the score when a filter now hides the job, look up a missing description once, or score it. */
export function rescoreStep(job: Pick<JobRow, "title" | "company" | "description" | "description_format">, config: Settings, progress: { lookedUp: boolean }): RescoreStep {
    const by = filterMatch(job, filterSet(config));
    if (by !== null) return { kind: "filtered", by };
    return job.description === null && !progress.lookedUp ? { kind: "lookup" } : { kind: "score" };
}
