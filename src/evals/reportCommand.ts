import { parseArgs } from "node:util";
import type { Result, Run } from "./format.js";
import type { EvalFiles } from "./files.js";
import { againstObserved, againstRun, summarize, type Context } from "./report.js";
import { reportLines } from "./reportText.js";

const USAGE = "usage: myjobbot eval report <run-id> [--against <run-id> | --against observed] [--reasons]";

export interface ReportDeps {
    files: EvalFiles;
    print: (line: string) => void;
}

/** Prints a run's report, judged against the answer keys as they are now, alone or against another run or production's own scores. */
export async function reportCommand(args: string[], deps: ReportDeps): Promise<number> {
    const options = readArgs(args);
    if (options === null) return printed(deps, [USAGE], 2);
    const [context, runs] = await Promise.all([contextOf(deps.files), deps.files.runs()]);
    const find = (id: string) => runs.items.find((each) => each.id === id)?.value;
    const run = find(options.runId);
    if (run === undefined) return printed(deps, [`no run ${options.runId}`], 1);
    const report = summarize(run, await resultsOf(deps.files, run), context);
    if (options.against === undefined) return printed(deps, reportLines(report, null, options.reasons), 0);
    if (options.against === "observed") return printed(deps, reportLines(report, againstObserved(report, context), options.reasons), 0);
    const other = find(options.against);
    if (other === undefined) return printed(deps, [`no run ${options.against}`], 1);
    return printed(deps, reportLines(report, againstRun(report, summarize(other, await resultsOf(deps.files, other), context)), options.reasons), 0);
}

/** Reads the run id and flags, or null when they don't fit the command's form. */
function readArgs(args: string[]) {
    try {
        const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { against: { type: "string" }, reasons: { type: "boolean" } } });
        const [runId] = positionals;
        return runId === undefined || positionals.length > 1 ? null : { runId, against: values.against, reasons: values.reasons === true };
    } catch {
        return null;
    }
}

/** Reads the cases, answer keys and profiles a report judges against. */
export async function contextOf(files: EvalFiles): Promise<Context> {
    const [cases, keys, profiles] = await Promise.all([files.cases(), files.answerKeys(), files.profiles()]);
    const map = <T>(items: Array<{ id: string; value: T }>) => new Map(items.map((each) => [each.id, each.value]));
    return { cases: map(cases.items), keys: map(keys.items), profiles: map(profiles.items) };
}

/** Reads a run's results, keeping the good lines. */
async function resultsOf(files: EvalFiles, run: Run): Promise<Result[]> {
    return (await files.results(run.id)).items;
}

/** Prints lines and gives back an exit code. */
function printed(deps: ReportDeps, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}
