import type { UserRun } from "../app/runLines.js";
import type { PartEnd, PartStart, RunHistory, RunTotals } from "../db/runHistory.js";
import { runFailureReason } from "./failureReason.js";
import { partOutcomeOf } from "./partOutcome.js";
import { runOutcome } from "./runStatus.js";
import type { TallyTotals } from "./tallyEvents.js";

export interface RecorderTimers {
    now(): Date;
    every(ms: number, tick: () => void): () => void;
}

interface RecorderOptions {
    timers?: RecorderTimers;
    log?: (line: string) => void;
}

const HEARTBEAT_MS = 60_000;
const WRITE_FAILED = "run_history_failed";

type RunWrites = Omit<RunHistory, "pruneBefore">;

/** Gives the real clock, and an interval that never keeps the process alive on its own. */
const REAL_TIMERS: RecorderTimers = {
    now: () => new Date(),
    every: (ms, tick) => {
        const timer = setInterval(tick, ms);
        timer.unref();
        return () => clearInterval(timer);
    },
};

/** Records one run as it goes: its start and heartbeat, each user's part, and how it ended; a write that fails is logged and never stops the run. */
export class RunRecorder {
    private readonly timers: RecorderTimers;
    private readonly log: (line: string) => void;
    private readonly ended: PartEnd[] = [];
    private stopHeartbeat: () => void = () => {};
    private behind = false;

    constructor(
        private readonly history: RunWrites,
        private readonly runId: string,
        options: RecorderOptions = {},
    ) {
        this.timers = options.timers ?? REAL_TIMERS;
        this.log = options.log ?? console.error;
    }

    /** Records the run's start and starts its heartbeat. */
    async begin(): Promise<void> {
        await this.write((history) => history.begin(this.runId, this.at()));
        this.stopHeartbeat = this.timers.every(HEARTBEAT_MS, () => void this.write((history) => history.alive(this.runId, this.at())));
    }

    /** Records that a user's part started, before any of its work, and gives the part to end later. */
    async partStarted(userId: number, partId: string): Promise<PartStart> {
        const part = { runId: this.runId, userId, partId, at: this.at() };
        await this.write((history) => history.partStarted(part));
        return part;
    }

    /** Records how a user's part ended and what it did; a part that never started (a skip, a deletion) is written once here. */
    async partEnded(started: PartStart | null, run: UserRun, totals: TallyTotals): Promise<void> {
        const at = this.at();
        const part: PartEnd = { ...(started ?? { runId: this.runId, userId: run.userId, partId: null, at }), endedAt: at, ...partOutcomeOf(run), totals };
        this.ended.push(part);
        await this.write((history) => history.partEnded(part));
    }

    /** Records that the run got through every user, with its outcome and totals, and stops the heartbeat. */
    async end(): Promise<void> {
        this.stopHeartbeat();
        const outcome = runOutcome(this.ended.map((part) => part.outcome));
        await this.write((history) => history.end(this.runId, { at: this.at(), outcome, reason: null, totals: this.totals() }));
    }

    /** Records that the run itself failed, by a fixed reason, with what its parts did before, and stops the heartbeat. */
    async fail(error: unknown): Promise<void> {
        this.stopHeartbeat();
        await this.write((history) => history.end(this.runId, { at: this.at(), outcome: "failed", reason: runFailureReason(error), totals: this.totals() }));
    }

    /** Adds up the ended parts: how many users, failed and skipped, and everything they did. */
    private totals(): RunTotals {
        const sum = { users: this.ended.length, usersFailed: 0, usersSkipped: 0, fetches: 0, fetchFailures: 0, jobsFound: 0, jobsScored: 0, searches: 0, searchFailures: 0, modelCalls: 0, promptTokens: 0, completionTokens: 0 };
        for (const part of this.ended) {
            for (const key of Object.keys(part.totals) as Array<keyof TallyTotals>) sum[key] += part.totals[key];
            sum.usersFailed += part.outcome === "failed" ? 1 : 0;
            sum.usersSkipped += part.outcome === "skipped" ? 1 : 0;
        }
        return sum;
    }

    /** Runs one write, logging a failure by its fixed line and, once a write succeeds again, marking the run's record incomplete. */
    private async write(step: (history: RunWrites) => Promise<void>): Promise<void> {
        try {
            await step(this.history);
            if (this.behind) await this.history.markIncomplete(this.runId);
            this.behind = false;
        } catch {
            this.log(WRITE_FAILED);
            this.behind = true;
        }
    }

    /** Gives the time now, as stored. */
    private at(): string {
        return this.timers.now().toISOString();
    }
}
