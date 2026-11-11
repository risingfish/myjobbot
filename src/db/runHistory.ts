import type { PartOutcome, RunOutcome } from "../monitoring/runStatus.js";
import type { TallyTotals } from "../monitoring/tallyEvents.js";

export interface PartStart {
    runId: string;
    userId: number;
    partId: string | null;
    at: string;
}

export interface PartEnd extends PartStart {
    endedAt: string;
    outcome: Exclude<PartOutcome, "running">;
    reason: string | null;
    totals: TallyTotals;
}

export interface RunTotals extends TallyTotals {
    users: number;
    usersFailed: number;
    usersSkipped: number;
}

export interface RunEnding {
    at: string;
    outcome: RunOutcome;
    reason: string | null;
    totals: RunTotals;
}

export interface RunHistory {
    begin(runId: string, at: string): Promise<void>;
    alive(runId: string, at: string): Promise<void>;
    partStarted(part: PartStart): Promise<void>;
    partEnded(part: PartEnd): Promise<void>;
    markIncomplete(runId: string): Promise<void>;
    end(runId: string, ending: RunEnding): Promise<void>;
    pruneBefore(cutoff: string): Promise<void>;
}
