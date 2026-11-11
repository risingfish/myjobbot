export type PartOutcome = "running" | "finished" | "stopped" | "failed" | "skipped" | "deleted" | "held";

export type RunOutcome = "finished" | "finished_with_errors" | "failed";

const SET_ASIDE: ReadonlySet<PartOutcome> = new Set(["finished", "skipped", "deleted", "held"]);

/** Tells how a run that got through every user ended: finished when every part finished or was set aside, otherwise finished with errors. */
export function runOutcome(parts: PartOutcome[]): RunOutcome {
    return parts.every((part) => SET_ASIDE.has(part)) ? "finished" : "finished_with_errors";
}
