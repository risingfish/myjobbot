import type { TallyTotals } from "../../src/monitoring/tallyEvents.js";
import type { PartEnd, PartStart, RunEnding, RunHistory, RunTotals } from "../../src/db/runHistory.js";
import { latestPerSource, type FetchHistory, type FetchRecord, type RecentFetch } from "../../src/db/fetchHistory.js";
import type { MailLog, MailSend } from "../../src/db/mailLog.js";
import type { FetchRow, MonitoringReads, PartRow, RunRow } from "../../src/db/monitoringReads.js";
import { storedPartOutcome, storedRunOutcome } from "../../src/monitoring/runStatus.js";
import type { MemoryCareersStore } from "./memoryCareersStore.js";

export interface StoredRun {
    id: string;
    startedAt: string;
    aliveAt: string;
    endedAt: string | null;
    outcome: string | null;
    reason: string | null;
    incomplete: boolean;
    totals: RunTotals | null;
}

export interface StoredPart {
    runId: string;
    userId: number;
    partId: string | null;
    startedAt: string;
    endedAt: string | null;
    outcome: string;
    reason: string | null;
    totals: TallyTotals | null;
}

export interface StoredFetch extends FetchRecord {
    userId: number;
}

export class MemoryMailLog implements MailLog {
    sends: MailSend[] = [];

    async record(send: MailSend): Promise<void> {
        this.sends.push(send);
    }

    async pruneBefore(cutoff: string): Promise<void> {
        this.sends = this.sends.filter((send) => send.at >= cutoff);
    }
}

export class MemoryFetchHistory implements FetchHistory {
    fetches: StoredFetch[] = [];

    async record(userId: number, fetch: FetchRecord): Promise<void> {
        this.fetches.push({ userId, ...fetch });
    }

    async recent(userId: number, sourceIds: number[], perSource: number): Promise<Map<number, RecentFetch[]>> {
        const mine = this.fetches.filter((fetch) => fetch.userId === userId && sourceIds.includes(fetch.sourceId)).reverse();
        const newest = mine.sort((left, right) => right.at.localeCompare(left.at));
        return latestPerSource(newest.map(({ sourceId, at, outcome, reason, jobs }) => ({ sourceId, at, outcome, reason, jobs })), perSource);
    }

    async pruneBefore(cutoff: string): Promise<void> {
        this.fetches = this.fetches.filter((fetch) => fetch.at >= cutoff);
    }

    dropUser(userId: number): void {
        this.fetches = this.fetches.filter((fetch) => fetch.userId !== userId);
    }
}

export class MemoryRunHistory implements RunHistory {
    readonly runs: StoredRun[] = [];
    parts: StoredPart[] = [];

    async begin(runId: string, at: string): Promise<void> {
        this.runs.push({ id: runId, startedAt: at, aliveAt: at, endedAt: null, outcome: null, reason: null, incomplete: false, totals: null });
    }

    async alive(runId: string, at: string): Promise<void> {
        this.update(runId, { aliveAt: at });
    }

    async partStarted(part: PartStart): Promise<void> {
        this.parts.push({ runId: part.runId, userId: part.userId, partId: part.partId, startedAt: part.at, endedAt: null, outcome: "running", reason: null, totals: null });
    }

    async partEnded(part: PartEnd): Promise<void> {
        const ending = { endedAt: part.endedAt, outcome: part.outcome, reason: part.reason, totals: part.totals };
        const found = this.parts.find((row) => row.runId === part.runId && row.userId === part.userId);
        if (found === undefined) this.parts.push({ runId: part.runId, userId: part.userId, partId: part.partId, startedAt: part.at, ...ending });
        else Object.assign(found, ending);
    }

    async markIncomplete(runId: string): Promise<void> {
        this.update(runId, { incomplete: true });
    }

    async end(runId: string, ending: RunEnding): Promise<void> {
        this.update(runId, { endedAt: ending.at, aliveAt: ending.at, outcome: ending.outcome, reason: ending.reason, totals: ending.totals });
    }

    async pruneBefore(cutoff: string): Promise<void> {
        const kept = this.runs.filter((run) => run.startedAt >= cutoff);
        this.runs.splice(0, this.runs.length, ...kept);
        this.parts = this.parts.filter((part) => kept.some((run) => run.id === part.runId));
    }

    dropUser(userId: number): void {
        this.parts = this.parts.filter((part) => part.userId !== userId);
    }

    private update(runId: string, change: Partial<StoredRun>): void {
        const run = this.runs.find((row) => row.id === runId);
        if (run !== undefined) Object.assign(run, change);
    }
}

export class MemoryMonitoringReads implements MonitoringReads {
    constructor(
        private readonly history: MemoryRunHistory,
        private readonly fetchHistory: MemoryFetchHistory,
        private readonly careers: MemoryCareersStore,
    ) {}

    async runs(since: string): Promise<RunRow[]> {
        return this.history.runs.filter((run) => run.startedAt >= since).sort((left, right) => right.startedAt.localeCompare(left.startedAt)).map(runRow);
    }

    async run(runId: string): Promise<{ run: RunRow; parts: PartRow[] } | null> {
        const run = this.history.runs.find((each) => each.id === runId);
        if (run === undefined) return null;
        const parts = this.history.parts.filter((part) => part.runId === runId).sort((left, right) => left.userId - right.userId);
        return { run: runRow(run), parts: parts.map((part) => ({ userId: part.userId, partId: part.partId, startedAt: part.startedAt, endedAt: part.endedAt, outcome: storedPartOutcome(part.outcome), reason: part.reason, totals: part.totals ?? NONE, lookups: this.careers.rows.filter((row) => row.runId === part.partId && row.step === "finish").length })) };
    }

    async fetches(since: string): Promise<FetchRow[]> {
        return this.fetchHistory.fetches
            .filter((fetch) => fetch.at >= since)
            .reverse()
            .sort((left, right) => right.at.localeCompare(left.at))
            .map(({ sourceId, module, at, outcome, reason, pages, jobs, cost }) => ({ sourceId, module, at, outcome, reason, pages, jobs, cost }));
    }
}

const NONE: TallyTotals = { fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };

function runRow(run: StoredRun): RunRow {
    return { id: run.id, startedAt: run.startedAt, aliveAt: run.aliveAt, endedAt: run.endedAt, outcome: storedRunOutcome(run.outcome), reason: run.reason, incomplete: run.incomplete, totals: run.totals ?? { ...NONE, users: 0, usersFailed: 0, usersSkipped: 0 } };
}
