import type { PartRow, RunRow } from "../db/monitoringReads.js";
import { runStatus, type PartOutcome, type RunStatus } from "../monitoring/runStatus.js";
import { perDay, type ChartSeries } from "./chartSeries.js";
import { durationText } from "./counts.js";
import { localTime } from "./localTime.js";

export interface RunRowView {
    id: string;
    started: string;
    duration: string;
    status: string;
    users: number;
    fetches: string;
    jobs: string;
    modelCalls: number;
    incomplete: boolean;
}

export interface PartRowView {
    user: string;
    outcome: string;
    reason: string | null;
    fetches: string;
    jobs: string;
    lookups: number;
    searches: string;
    model: string;
}

const STATUS_TEXT: Record<RunStatus, string> = { running: "running", never_finished: "never finished", finished: "finished", finished_with_errors: "finished with errors", failed: "failed" };
const PART_TEXT: Record<PartOutcome, string> = { running: "running", finished: "finished", stopped: "stopped early", failed: "failed", skipped: "skipped", deleted: "deleted", held: "deletion held" };
/** Shows how long something took, or a dash while it hasn't ended. */
function duration(startedAt: string, endedAt: string | null): string {
    return durationText(endedAt === null ? null : Date.parse(endedAt) - Date.parse(startedAt));
}

/** Shows a count with how many of it failed, when any did. */
function withFailures(count: number, failures: number): string {
    return failures === 0 ? String(count) : `${count} (${failures} failing)`;
}

/** Shows one run as the Monitoring page lists it. */
function runRow(run: RunRow, now: Date): RunRowView {
    const { totals } = run;
    return { id: run.id, started: localTime(run.startedAt) ?? "", duration: duration(run.startedAt, run.endedAt), status: STATUS_TEXT[runStatus(run, now)], users: totals.users, fetches: withFailures(totals.fetches, totals.fetchFailures), jobs: `${totals.jobsFound} found, ${totals.jobsScored} scored`, modelCalls: totals.modelCalls, incomplete: run.incomplete };
}

/** Lists the runs as the Monitoring page shows them, newest first as read. */
export function runRows(runs: RunRow[], now: Date): RunRowView[] {
    return runs.map((run) => runRow(run, now));
}

/** Shows one user's part of a run, by user id only; a part still running when its run stopped showing signs of life is said to have been running when it stopped. */
function partRow(part: PartRow, died: boolean): PartRowView {
    const { totals } = part;
    const outcome = part.outcome === "running" && died ? "running when it stopped" : PART_TEXT[part.outcome];
    return { user: `User ${part.userId}`, outcome, reason: part.reason, fetches: withFailures(totals.fetches, totals.fetchFailures), jobs: `${totals.jobsFound} found, ${totals.jobsScored} scored`, lookups: part.lookups, searches: withFailures(totals.searches, totals.searchFailures), model: `${totals.modelCalls} calls, ${totals.promptTokens + totals.completionTokens} tokens` };
}

/** Shows one run and each user's part of it. */
export function runDetailRows(detail: { run: RunRow; parts: PartRow[] }, now: Date): { run: RunRowView; parts: PartRowView[] } {
    const died = runStatus(detail.run, now) === "never_finished";
    return { run: runRow(detail.run, now), parts: detail.parts.map((part) => partRow(part, died)) };
}

/** Counts the runs started each day by how they stand. */
export function runsPerDay(runs: RunRow[], now: Date): ChartSeries {
    return perDay([...runs].reverse(), (run) => (localTime(run.startedAt) ?? "").slice(0, 10), (run) => STATUS_TEXT[runStatus(run, now)]);
}
