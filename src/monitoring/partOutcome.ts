import type { UserRun } from "../app/runLines.js";
import type { PartOutcome } from "./runStatus.js";

export interface PartResult {
    outcome: Exclude<PartOutcome, "running">;
    reason: string | null;
}

/** Gives how a user's part of a run ended and its fixed reason, from what the run reported for them. */
export function partOutcomeOf(run: UserRun): PartResult {
    if ("report" in run) return { outcome: run.report.status === "finished" ? "finished" : "stopped", reason: null };
    if ("skipped" in run) return { outcome: "skipped", reason: run.skipped };
    if ("failed" in run) return { outcome: "failed", reason: run.reason };
    if ("deleted" in run) return { outcome: "deleted", reason: null };
    return { outcome: "held", reason: run.held };
}
