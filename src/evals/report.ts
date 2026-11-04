import type { AnswerKey, EvalCase, Profile, Result, Run } from "./format.js";
import { judge } from "./judge.js";

const UNSTABLE_RANGE = 10;
const MOVED_BY = 5;

export type CaseState = "pass" | "fail" | "mixed" | "-";

export interface Context {
    cases: Map<string, EvalCase>;
    keys: Map<string, AnswerKey>;
    profiles: Map<string, Profile>;
}

export interface CaseRow {
    id: string;
    evalCase: EvalCase | null;
    key: AnswerKey | null;
    attempts: Array<Result & { judged: boolean | null }>;
    state: CaseState;
    median: number | null;
    range: { min: number; max: number } | null;
    unstable: boolean;
    tokens: number;
    ms: number;
}

export interface RunReport {
    run: Run;
    rows: CaseRow[];
    passed: number;
    judged: number;
    tokensIn: number;
    tokensOut: number;
    ms: number;
    changedKeys: string[];
}

interface Move {
    id: string;
    from: CaseState;
    to: CaseState;
    fromScore: number | null;
    toScore: number | null;
}

/** Sums up a run, judging every attempt against the answer keys as they are now: per case its scores, state, spread, tokens and time, and the run's totals. */
export function summarize(run: Run, results: Result[], context: Context): RunReport {
    const rows = run.cases.map((id) => caseRow(id, results, context));
    const attempts = rows.flatMap((row) => row.attempts);
    const judged = attempts.filter((attempt) => attempt.judged !== null);
    const changedKeys = rows.filter((row) => row.key !== null && Date.parse(row.key.writtenAt) > Date.parse(run.startedAt)).map((row) => row.id);
    const sum = (pick: (result: Result) => number | null) => attempts.reduce((total, attempt) => total + (pick(attempt) ?? 0), 0);
    return { run, rows, passed: judged.filter((attempt) => attempt.judged === true).length, judged: judged.length, tokensIn: sum((each) => each.tokensIn), tokensOut: sum((each) => each.tokensOut), ms: sum((each) => each.ms), changedKeys };
}

/** Compares a run with another over the cases both ran: how many attempts passed in each, the cases fixed and broken, the cases that moved, and the change in tokens and time. */
export function againstRun(report: RunReport, other: RunReport) {
    const before = new Map(other.rows.map((row) => [row.id, row]));
    const pairs = report.rows.flatMap((row) => {
        const earlier = before.get(row.id);
        return earlier === undefined ? [] : [{ id: row.id, from: earlier.state, to: row.state, fromScore: earlier.median, toScore: row.median }];
    });
    const fixed = pairs.filter((pair) => pair.from !== "pass" && pair.from !== "-" && pair.to === "pass").length;
    const broken = pairs.filter((pair) => pair.from === "pass" && pair.to !== "pass").length;
    return { other: other.run.id, passedFrom: other.passed, passedTo: report.passed, fixed, broken, tokens: change(totalTokens(other), totalTokens(report)), ms: report.ms - other.ms, moves: pairs.filter(moved) };
}

/** Compares a run with the scores production gave its cases, leaving out cases whose observed score read less of the job or an older description, counted by reason. */
export function againstObserved(report: RunReport, context: Context) {
    const leftOut = { summary: 0, unknown: 0, changed: 0 };
    const pairs: Move[] = [];
    for (const row of report.rows) {
        const observed = row.evalCase?.observed ?? null;
        if (row.evalCase === null || observed === null) continue;
        if (row.evalCase.descriptionChangedSinceScored) leftOut.changed += 1;
        else if (observed.read !== "details") leftOut[observed.read] += 1;
        else pairs.push({ id: row.id, from: observedState(row, context), to: row.state, fromScore: observed.score, toScore: row.median });
    }
    return { compared: pairs.length, moves: pairs.filter(moved), leftOut };
}

/** Gathers one case's attempts, judged now, with its state, median, spread, tokens and time. */
function caseRow(id: string, results: Result[], context: Context): CaseRow {
    const evalCase = context.cases.get(id) ?? null;
    const key = context.keys.get(id) ?? null;
    const threshold = evalCase === null ? undefined : context.profiles.get(evalCase.profile)?.matchThreshold;
    const attempts = results.filter((result) => result.case === id).map((result) => ({ ...result, judged: threshold === undefined ? null : judge(key, result, threshold) }));
    const scores = attempts.flatMap((attempt) => (attempt.score === null ? [] : [attempt.score]));
    const range = scores.length === 0 ? null : { min: Math.min(...scores), max: Math.max(...scores) };
    const state = stateOf(attempts.map((attempt) => attempt.judged));
    const unstable = state === "mixed" || (range !== null && range.max - range.min >= UNSTABLE_RANGE);
    const tokens = attempts.reduce((sum, attempt) => sum + (attempt.tokensIn ?? 0) + (attempt.tokensOut ?? 0), 0);
    return { id, evalCase, key, attempts, state, median: median(scores), range, unstable, tokens, ms: attempts.reduce((sum, attempt) => sum + attempt.ms, 0) };
}

/** Names a case's state from its attempts' verdicts: all passed, all failed, some of each, or not judged. */
function stateOf(verdicts: Array<boolean | null>): CaseState {
    const judged = verdicts.filter((verdict) => verdict !== null);
    if (judged.length === 0) return "-";
    if (judged.every((verdict) => verdict)) return "pass";
    return judged.some((verdict) => verdict) ? "mixed" : "fail";
}

/** Judges production's own score of a case against its answer key now. */
function observedState(row: CaseRow, context: Context): CaseState {
    const observed = row.evalCase?.observed;
    const threshold = row.evalCase === null ? undefined : context.profiles.get(row.evalCase.profile)?.matchThreshold;
    if (observed === undefined || observed === null || threshold === undefined) return "-";
    return stateOf([judge(row.key, { ...observed, failure: null }, threshold)]);
}

/** Tells whether a case moved: its state changed, or its median score by 5 or more. */
function moved(move: Move): boolean {
    if (move.from !== move.to) return true;
    return move.fromScore !== null && move.toScore !== null && Math.abs(move.toScore - move.fromScore) >= MOVED_BY;
}

/** Gives the middle of the scores, the mean of the middle two for an even count, or null for none. */
function median(scores: number[]): number | null {
    if (scores.length === 0) return null;
    const sorted = [...scores].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Gives a run's tokens in and out. */
function totalTokens(report: RunReport): number {
    return report.tokensIn + report.tokensOut;
}

/** Gives the change from one count to another as a fraction of the first, or null when the first is 0. */
function change(from: number, to: number): number | null {
    return from === 0 ? null : (to - from) / from;
}
