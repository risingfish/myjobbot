import type { EvalFiles } from "./files.js";
import { summarize, type CaseState, type RunReport } from "./report.js";
import { contextOf } from "./reportCommand.js";
import { aligned, duration, shortened } from "./reportText.js";
import { SERIES_USAGE } from "./series.js";
import type { Series, SeriesRun } from "./seriesFormat.js";
import { userText } from "./userNote.js";

const NOT_RUN = "not run";

interface TestResult {
    label: string;
    variant: string | null;
    model: string | null;
    report: RunReport | null;
}

interface Found {
    name: string;
    series: Series;
    record: SeriesRun;
}

/** Prints a series run's report: its latest run, or the one named, with each test's run judged against today's answer keys. */
export async function seriesReport(args: string[], deps: { files: EvalFiles; print: (line: string) => void }): Promise<number> {
    const [name, flag, chosen] = args;
    if (name === undefined || (flag !== undefined && (flag !== "--run" || chosen === undefined))) return printed(deps, [SERIES_USAGE], 2);
    const found = await findRecord(deps.files, name, chosen);
    if (typeof found === "string") return printed(deps, [found], 1);
    return printed(deps, seriesReportLines({ ...found, tests: await testResults(deps.files, found) }), 0);
}

/** Finds a series and its latest run, or the run named, or says which is missing. */
async function findRecord(files: EvalFiles, name: string, chosen: string | undefined): Promise<Found | string> {
    const series = (await files.series()).items.find((each) => each.id === name)?.value;
    if (series === undefined) return `no series ${name}`;
    const records = (await files.seriesRuns()).items.filter((each) => each.value.series === name && (chosen === undefined || each.id === chosen));
    const record = records.sort((a, b) => b.id.localeCompare(a.id))[0]?.value;
    return record === undefined ? `no run of series ${name}${chosen === undefined ? "" : ` named ${chosen}`}` : { name, series, record };
}

/** Sums up the run each test of a series run made, or none for a test that didn't run. */
async function testResults(files: EvalFiles, { series, record }: Found): Promise<TestResult[]> {
    const [context, runs] = await Promise.all([contextOf(files), files.runs()]);
    return Promise.all(
        series.tests.map(async (test) => {
            const run = runs.items.find((each) => each.id === record.runs[test.label])?.value;
            return { ...test, report: run === undefined ? null : summarize(run, (await files.results(run.id)).items, context) };
        }),
    );
}

/** Sets a series run's tests side by side: each test's pass rate, tokens and time, then each case's state under each test, the cases the tests split on first; never a description. */
function seriesReportLines({ name, series, record, tests }: Found & { tests: TestResult[] }): string[] {
    const ran = tests.find((test) => test.report !== null)?.report ?? null;
    const scope = series.tags.length > 0 ? ` · tag ${series.tags.join(", ")}` : "";
    const header = `series ${name} · run ${record.id} · ${ran?.rows.length ?? "?"} cases × ${series.repeats}${scope}${record.endedAt === null ? " · unfinished" : ""}`;
    return [header, "tests:", ...aligned(tests.map(testCells)), "cases (splits first):", ...caseLines(tests, ran)];
}

/** Gives one test's cells: its label, prompt, pass rate, tokens, time, user and model, or that it didn't run. */
function testCells({ label, variant, model, report }: TestResult): string[] {
    const prompt = variant ?? "code";
    if (report === null) return [label, prompt, NOT_RUN];
    const rate = report.judged === 0 ? "" : ` (${Math.round((100 * report.passed) / report.judged)}%)`;
    const drift = report.run.promptChanged === true ? "(prompt changed since export)" : "";
    return [label, prompt, `passed ${report.passed}/${report.judged}${rate}`, `${((report.tokensIn + report.tokensOut) / 1000).toFixed(1)}k tok`, duration(report.ms), userText(report.run), model ?? "", drift];
}

/** Writes a line per case with its state under each test, the cases whose states differ between the tests that ran listed first. */
function caseLines(tests: TestResult[], ran: RunReport | null): string[] {
    const rows = (ran?.rows ?? []).map((row) => {
        const states = tests.map((test) => stateIn(test.report, row.id));
        const known = new Set(states.filter((state) => state !== NOT_RUN));
        return { cells: [row.id, shortened(`${row.evalCase?.title ?? "?"} · ${row.evalCase?.company ?? "?"}`), ...states], split: known.size > 1 };
    });
    return aligned([...rows.filter((row) => row.split), ...rows.filter((row) => !row.split)].map((row) => row.cells));
}

/** Gives a case's state in one test's run, or that the test didn't run. */
function stateIn(report: RunReport | null, caseId: string): CaseState | typeof NOT_RUN {
    if (report === null) return NOT_RUN;
    return report.rows.find((row) => row.id === caseId)?.state ?? NOT_RUN;
}

/** Prints lines and gives back an exit code. */
function printed(deps: { print: (line: string) => void }, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}
