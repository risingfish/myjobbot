import { parseArgs } from "node:util";
import type { EvalCase, Result, Run } from "./format.js";
import type { EvalFiles } from "./files.js";
import { againstObserved, againstRun, summarize, type Context } from "./report.js";
import { contextOf, type ContextFiles } from "./reportContext.js";
import { reportLines } from "./reportText.js";
import { observedNote, runsNote } from "./userNote.js";

const USAGE = "usage: myjobbot eval report <run-id> [--against <run-id> | --against observed] [--reasons]";

export interface ReportDeps {
    files: ContextFiles & Pick<EvalFiles, "runs" | "results">;
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
    if (options.against === "observed") return printed(deps, reportLines(report, againstObserved(report, context), options.reasons, observedNote(run, casesOf(run, context))), 0);
    const other = find(options.against);
    if (other === undefined) return printed(deps, [`no run ${options.against}`], 1);
    return printed(deps, reportLines(report, againstRun(report, summarize(other, await resultsOf(deps.files, other), context)), options.reasons, runsNote(run, other)), 0);
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

/** Gives the stored cases a run scored, leaving out any no longer stored. */
function casesOf(run: Run, context: Context): EvalCase[] {
    return run.cases.flatMap((id) => context.cases.get(id) ?? []);
}

/** Reads a run's results, keeping the good lines. */
async function resultsOf(files: Pick<EvalFiles, "results">, run: Run): Promise<Result[]> {
    return (await files.results(run.id)).items;
}

/** Prints lines and gives back an exit code. */
function printed(deps: ReportDeps, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}
