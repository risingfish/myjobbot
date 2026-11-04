import type { Result, Run } from "./format.js";

/** Writes one attempt's line as it ends: its place in the run, the case, the score or why there is none, the verdict, tokens and time. */
export function attemptLine(done: number, total: number, result: Result): string {
    const width = String(total).length;
    const outcome = result.score === null ? (result.failure ?? "no score") : String(result.score);
    const verdict = result.passed === null ? "-" : result.passed ? "pass" : "fail";
    return `[${String(done).padStart(width)}/${total}] ${result.case} #${result.attempt}  ${outcome}  ${verdict}  ${tokens(result)}  ${(result.ms / 1000).toFixed(1)}s`;
}

/** Writes the run's summary: how many judged attempts passed, how many failed to score, tokens and time. */
export function summaryLine(run: Run, results: Result[], endedAt: string): string {
    const judged = results.filter((result) => result.passed !== null);
    const passed = judged.filter((result) => result.passed === true).length;
    const failed = results.filter((result) => result.failure !== null).length;
    const used = results.reduce((sum, result) => sum + (result.tokensIn ?? 0) + (result.tokensOut ?? 0), 0);
    const seconds = Math.round((Date.parse(endedAt) - Date.parse(run.startedAt)) / 1000);
    return `run ${run.id}: ${passed}/${judged.length} passed · ${failed} failed ${failed === 1 ? "attempt" : "attempts"} · ${(used / 1000).toFixed(1)}k tokens · ${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

/** Writes an attempt's tokens in thousands, or a question mark when the server reported none. */
function tokens(result: Result): string {
    if (result.tokensIn === null && result.tokensOut === null) return "? tok";
    return `${(((result.tokensIn ?? 0) + (result.tokensOut ?? 0)) / 1000).toFixed(1)}k tok`;
}
