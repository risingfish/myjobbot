import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { importSqlite } from "./app/importSqlite.js";
import { runOnce } from "./app/run.js";
import type { Environment } from "./config/load.js";
import { openStores } from "./db/connect.js";
import { parseDbSettings } from "./db/settings.js";
import type { JobKey, Stores } from "./db/store.js";
import { describeError } from "./errors.js";
import { openRescore } from "./rescore/open.js";
import { rescore } from "./rescore/rescore.js";

const USAGE = "usage: myjobbot run | rescore <ats> <job_id> | import-sqlite <path>";

type Command = (environment: Environment, args: string[]) => Promise<number>;

const COMMANDS: Record<string, Command> = { run: runCommand, rescore: rescoreCommand, "import-sqlite": importCommand };

/** Parses argv and dispatches to the matching subcommand, returning the process exit code. */
async function main(argv: string[]): Promise<number> {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true });
    const command = COMMANDS[positionals[0] ?? ""];
    if (!command) return usage();
    if (existsSync(".env")) process.loadEnvFile(".env");
    return command(process.env, positionals.slice(1));
}

/** Runs one agent session, prints its outcome, and maps the result to an exit code. */
async function runCommand(environment: Environment): Promise<number> {
    const report = await runOnce(environment);
    console.log(`run ${report.runId} ${report.status} after ${report.steps} steps: ${report.reason}`);
    if (report.summary) console.log(report.summary);
    return report.status === "finished" ? 0 : 1;
}

/** Re-scores one job at once from the command line, printing its outcome and mapping a failure to exit code 1. */
async function rescoreCommand(environment: Environment, [ats, jobId]: string[]): Promise<number> {
    if (!ats || !jobId) return usage();
    const stores = await openStores(parseDbSettings(environment));
    try {
        return await rescoreWith(environment, stores, { ats, jobId });
    } finally {
        await stores.close();
    }
}

/** Opens a re-score against open stores, runs it for one job and prints the outcome, closing its page renderer afterward. */
async function rescoreWith(environment: Environment, stores: Stores, key: JobKey): Promise<number> {
    const opened = await openRescore(environment, stores);
    try {
        const result = await rescore(opened.deps, key);
        console.log(`rescore ${key.ats} ${key.jobId}: ${result.outcome}${result.outcome === "filtered" ? ` (${result.note})` : ""}`);
        return result.outcome === "failed" ? 1 : 0;
    } finally {
        await opened.close();
    }
}

/** Copies an old SQLite database into the configured MariaDB database once, printing the row counts. */
async function importCommand(environment: Environment, [path]: string[]): Promise<number> {
    if (!path) return usage();
    const report = await importSqlite(path, parseDbSettings(environment));
    console.log(`imported jobs ${report.jobs}, verdicts ${report.verdicts}, api_calls ${report.api_calls}, hidden ${report.hidden}`);
    return 0;
}

/** Prints the usage line and returns the exit code for a malformed command. */
function usage(): number {
    console.error(USAGE);
    return 2;
}

main(process.argv.slice(2)).then(
    (code) => {
        process.exitCode = code;
    },
    (error: unknown) => {
        console.error(`myjobbot: ${describeError(error)}`);
        process.exitCode = 1;
    },
);
