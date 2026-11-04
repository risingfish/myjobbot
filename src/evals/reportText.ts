import type { againstObserved, againstRun, CaseRow, RunReport } from "./report.js";

const MAX_TITLE = 60;

type RunComparison = ReturnType<typeof againstRun>;
type ObservedComparison = ReturnType<typeof againstObserved>;

/** Writes a run's report: its header and totals, a line per case, the unstable cases, answer keys changed since, and any comparison; never a description. */
export function reportLines(report: RunReport, comparison: RunComparison | ObservedComparison | null, reasons: boolean): string[] {
    const unstable = report.rows.filter((row) => row.unstable);
    return [headerLine(report), totalsLine(report), "cases:", ...caseLines(report.rows, reasons), ...(unstable.length === 0 ? [] : [`unstable (mixed or range ≥ 10): ${unstable.map((row) => `${row.id} (${row.range?.min ?? "?"}-${row.range?.max ?? "?"})`).join(", ")}`]), ...(report.changedKeys.length === 0 ? [] : [`answer key changed since the run: ${report.changedKeys.join(", ")}`]), ...(comparison === null ? [] : comparisonLines(comparison))];
}

/** Names the run, its model, prompt, size, and whether it ended. */
function headerLine({ run }: RunReport): string {
    const prompts = Object.values(run.prompts);
    const prompt = prompts.length === 1 ? `prompt ${prompts[0]}` : `${prompts.length} prompts`;
    const variant = run.variant === undefined || run.variant === null ? "" : ` · variant ${run.variant}${run.promptChanged === true ? " · prompt changed since export" : ""}`;
    return `run ${run.id} · model ${run.model} · ${prompt} · ${run.cases.length} cases × ${run.repeats}${variant}${run.endedAt === null ? " · unfinished" : ""}`;
}

/** Gives the pass rate, how many cases have answer keys, and the tokens and time used. */
function totalsLine(report: RunReport): string {
    const rate = report.judged === 0 ? "" : ` (${Math.round((100 * report.passed) / report.judged)}%)`;
    const keyed = report.rows.filter((row) => row.key !== null).length;
    return `passed ${report.passed}/${report.judged}${rate} · with answer keys ${keyed}/${report.rows.length} · tokens ${report.tokensIn.toLocaleString("en-US")} in / ${report.tokensOut.toLocaleString("en-US")} out · ${duration(report.ms)}`;
}

/** Writes a line per case, its columns lined up, with the failing attempts' reasons and gaps under it when asked. */
function caseLines(rows: CaseRow[], reasons: boolean): string[] {
    const cells = rows.map((row) => [row.id, shortened(`${row.evalCase?.title ?? "?"} · ${row.evalCase?.company ?? "?"}`), keyText(row), row.attempts.map((attempt) => attempt.score ?? attempt.failure ?? "?").join(" "), row.state, `${(row.tokens / 1000).toFixed(1)}k tok`, `${(row.ms / 1000).toFixed(1)}s`]);
    const lines = aligned(cells);
    return rows.flatMap((row, index) => [lines[index] ?? "", ...(reasons ? reasonLines(row) : [])]);
}

/** Writes each failing attempt's reasons and gaps as the model gave them. */
function reasonLines(row: CaseRow): string[] {
    return row.attempts.filter((attempt) => attempt.judged === false).map((attempt) => `      #${attempt.attempt} reasons: ${attempt.reasons.join("; ") || "-"} · gaps: ${attempt.gaps.join("; ") || "-"}`);
}

/** Describes a case's answer key: its verdict and score range, or that it has none. */
function keyText(row: CaseRow): string {
    if (row.key === null) return "no answer key";
    return row.key.score === null ? row.key.verdict : `${row.key.verdict} ${row.key.score.min}-${row.key.score.max}`;
}

/** Writes a comparison with another run or with production's scores, and the cases that moved. */
function comparisonLines(comparison: RunComparison | ObservedComparison): string[] {
    const moves = aligned(comparison.moves.map((move) => [move.id, `${move.from} → ${move.to}`, `${scoreText(move.fromScore)} → ${scoreText(move.toScore)}`]));
    if ("other" in comparison) {
        const tokens = comparison.tokens === null ? "?" : `${comparison.tokens >= 0 ? "+" : ""}${Math.round(comparison.tokens * 100)}%`;
        const ms = `${comparison.ms >= 0 ? "+" : "−"}${duration(Math.abs(comparison.ms))}`;
        return [`against ${comparison.other}: ${comparison.passedFrom}→${comparison.passedTo} passed (+${comparison.fixed} fixed, ${comparison.broken} broken) · tokens ${tokens} · time ${ms} · ${moves.length} moved`, ...moves];
    }
    const { summary, unknown, changed } = comparison.leftOut;
    return [`against observed: ${comparison.compared} compared, ${moves.length} moved · left out ${summary + unknown + changed} (summary ${summary}, unknown ${unknown}, description changed ${changed})`, ...moves];
}

/** Lays rows of cells out as indented lines with their columns lined up. */
export function aligned(cells: Array<Array<string | number>>): string[] {
    const widths = cells[0]?.map((_, column) => Math.max(...cells.map((line) => String(line[column]).length))) ?? [];
    return cells.map(
        (line) =>
            `  ${line
                .map((cell, column) => String(cell).padEnd(widths[column] ?? 0))
                .join("  ")
                .trimEnd()}`,
    );
}

/** Cuts a long title so the case lines stay readable. */
export function shortened(text: string): string {
    return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text;
}

/** Writes a median score, rounded, or a question mark when there is none. */
function scoreText(score: number | null): string {
    return score === null ? "?" : String(Math.round(score));
}

/** Writes a length of time as minutes and seconds. */
export function duration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}
