import { runEnd, type RescoreRun } from "../db/rescoreLogStore.js";
import type { VerdictView } from "../db/jobViews.js";
import type { HistoryEntry } from "./api.js";
import { minutes, shortRun } from "./rowViews.js";

interface Timed {
    at: string;
    entry: HistoryEntry;
}

/** Lists a job's history as one list, newest first: each verdict, marked when a re-score gave it, and each re-score that saved none, with how it ended. */
export function historyRows(verdicts: VerdictView[], runs: RescoreRun[], now: Date): HistoryEntry[] {
    const byId = new Map(runs.map((run) => [run.id, run]));
    const scored = verdicts.map((verdict): Timed => ({ at: verdict.scored_at, entry: verdictEntry(verdict, byId.get(verdict.run_id ?? "")) }));
    const given = new Set(verdicts.map((verdict) => verdict.run_id));
    const unscored = runs.filter((run) => !given.has(run.id)).map((run): Timed => ({ at: run.startedAt, entry: runEntry(run, now) }));
    return [...scored, ...unscored].sort((a, b) => b.at.localeCompare(a.at)).map((timed) => timed.entry);
}

/** Turns one recorded verdict into a line of the history, with its re-score's log when a re-score gave it. */
function verdictEntry(verdict: VerdictView, run: RescoreRun | undefined): HistoryEntry {
    const rescore = run === undefined ? null : { id: run.id, state: "scored" as const, filter: null };
    return { scoredAt: minutes(verdict.scored_at), total: verdict.score, base: verdict.base_score, bonus: verdict.bonus_score, run: shortRun(verdict.run_id), rescore };
}

/** Turns a re-score that saved no verdict into a line of the history saying how it ended, or that it is still running. */
function runEntry(run: RescoreRun, now: Date): HistoryEntry {
    const end = runEnd(run, now);
    const rescore = { id: run.id, state: end?.outcome ?? ("running" as const), filter: end?.filter ?? null };
    return { scoredAt: minutes(run.startedAt), total: null, base: null, bonus: null, run: shortRun(run.id), rescore };
}
