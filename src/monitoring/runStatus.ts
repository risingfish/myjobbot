const PART_OUTCOMES = ["running", "finished", "stopped", "failed", "skipped", "deleted", "held"] as const;
const RUN_OUTCOMES = ["finished", "finished_with_errors", "failed"] as const;

export type PartOutcome = (typeof PART_OUTCOMES)[number];

export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export type RunStatus = RunOutcome | "running" | "never_finished";

interface RunSigns {
    endedAt: string | null;
    aliveAt: string;
    outcome: RunOutcome | null;
}

const NEVER_FINISHED_MS = 5 * 60_000;

const SET_ASIDE: ReadonlySet<PartOutcome> = new Set(["finished", "skipped", "deleted", "held"]);

/** Tells how a run that got through every user ended: finished when every part finished or was set aside, otherwise finished with errors. */
export function runOutcome(parts: PartOutcome[]): RunOutcome {
    return parts.every((part) => SET_ASIDE.has(part)) ? "finished" : "finished_with_errors";
}

/** Tells how a run stands now: how it ended, or running while it shows signs of life, or never finished once it has shown none for 5 minutes. */
export function runStatus(run: RunSigns, now: Date): RunStatus {
    if (run.endedAt !== null) return run.outcome ?? "failed";
    return now.getTime() - Date.parse(run.aliveAt) >= NEVER_FINISHED_MS ? "never_finished" : "running";
}

/** Reads a stored run outcome, null for none or one this version doesn't know. */
export function storedRunOutcome(value: string | null): RunOutcome | null {
    return RUN_OUTCOMES.find((outcome) => outcome === value) ?? null;
}

/** Reads a stored part outcome, failed for one this version doesn't know. */
export function storedPartOutcome(value: string): PartOutcome {
    return PART_OUTCOMES.find((outcome) => outcome === value) ?? "failed";
}
