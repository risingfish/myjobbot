import type { PartOutcome, RunOutcome } from "../monitoring/runStatus.js";
import type { TallyTotals } from "../monitoring/tallyEvents.js";
import type { FetchRecord } from "./fetchHistory.js";
import type { RunTotals } from "./runHistory.js";

export interface RunRow {
    id: string;
    startedAt: string;
    aliveAt: string;
    endedAt: string | null;
    outcome: RunOutcome | null;
    reason: string | null;
    incomplete: boolean;
    totals: RunTotals;
}

export interface PartRow {
    userId: number;
    partId: string | null;
    startedAt: string;
    endedAt: string | null;
    outcome: PartOutcome;
    reason: string | null;
    totals: TallyTotals;
    lookups: number;
}

export type FetchRow = Omit<FetchRecord, "partId" | "ms" | "outcome"> & { outcome: string };

export interface MonitoringReads {
    runs(since: string): Promise<RunRow[]>;
    run(runId: string): Promise<{ run: RunRow; parts: PartRow[] } | null>;
    fetches(since: string): Promise<FetchRow[]>;
}
