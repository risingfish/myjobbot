import { runAll } from "../../src/app/runAll.js";
import type { RunSeams } from "../../src/app/run.js";
import type { RunReport } from "../../src/app/runLines.js";
import type { Environment } from "../../src/config/load.js";

export async function runOneUser(environment: Environment, seams: RunSeams, userId: number): Promise<RunReport> {
    const [run] = await runAll(environment, seams, userId);
    if (run === undefined) throw new Error("no run");
    if ("report" in run) return run.report;
    throw new Error("failed" in run ? run.failed : `skipped (${run.skipped})`);
}
