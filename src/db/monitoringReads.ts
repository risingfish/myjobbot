import type { PartOutcome, RunOutcome } from "../monitoring/runStatus.js";
import type { TallyTotals } from "../monitoring/tallyEvents.js";
import type { FetchRecord } from "./fetchHistory.js";
import type { ModelUse, RescoreRun } from "./rescoreLogStore.js";
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

export interface LookupRow {
    step: string;
    outcome: string;
    reason: string | null;
    pageSource: string | null;
}

export type RescoreRow = Pick<RescoreRun, "startedAt" | "endedAt" | "outcome" | "filter" | "score"> & ModelUse;

export interface MailRow {
    at: string;
    kind: string;
    outcome: string;
    reason: string | null;
}

export interface MonitoringReads {
    runs(since: string): Promise<RunRow[]>;
    run(runId: string): Promise<{ run: RunRow; parts: PartRow[] } | null>;
    fetches(since: string): Promise<FetchRow[]>;
    lookups(since: string): Promise<LookupRow[]>;
    rescores(since: string): Promise<RescoreRow[]>;
    mails(since: string): Promise<MailRow[]>;
}
