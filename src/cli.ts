import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { runAccountCommand } from "./accounts/terminal.js";
import { importSqlite } from "./app/importSqlite.js";
import { runAll } from "./app/runAll.js";
import { runExitCode, runLine, type UserRun } from "./app/runLines.js";
import type { Environment } from "./config/load.js";
import { openStores } from "./db/connect.js";
import { parseDbSettings } from "./db/settings.js";
import { OWNER_ID } from "./db/searchSettingsStore.js";
import type { JobKey } from "./db/store.js";
import type { UserStores } from "./db/userStores.js";
import { describeError } from "./errors.js";
import { evalCommand } from "./evals/command.js";
import { openRescore } from "./rescore/open.js";
import { rescore } from "./rescore/rescore.js";
import { alreadyRunningLine, commandLine, consoleLine } from "./rescore/steps.js";

const USAGE = "usage: myjobbot run | rescore <ats> <job_id> | import-sqlite <path> | eval <check|capture|answer-key|run|report> | account <init|reset> <email>";

type Command = (environment: Environment, args: string[]) => Promise<number>;

const COMMANDS: Record<string, Command> = { run: positional(runCommand), rescore: positional(rescoreCommand), "import-sqlite": positional(importCommand), eval: evalCommand, account: positional(runAccountCommand) };

/** Dispatches to the command named first, handing it the rest of the arguments as given, and returns the process exit code. */
async function main(argv: string[]): Promise<number> {
    const [name = "", ...args] = argv;
    const command = COMMANDS[name];
    if (!command) return usage();
    if (existsSync(".env")) process.loadEnvFile(".env");
    return command(process.env, args);
}

/** Wraps a command that takes positional arguments only, refusing any flag as before. */
function positional(command: Command): Command {
    return (environment, args) => command(environment, parseArgs({ args, allowPositionals: true }).positionals);
}

/** Runs every user's agent session, prints each user's outcome, and maps the results to an exit code. */
async function runCommand(environment: Environment): Promise<number> {
    const runs = await runAll(environment, {});
    for (const run of runs) printRun(run);
    return runExitCode(runs, undefined);
}

/** Prints one user's line, then their summary when they ran, or why they failed on standard error. */
function printRun(run: UserRun): void {
    console.log(runLine(run));
    if ("report" in run && run.report.summary) console.log(run.report.summary);
    if ("failed" in run) console.error(`myjobbot: ${run.failed}`);
}

/** Re-scores one job at once from the command line, printing its log and outcome and mapping a failure, or a re-score already running, to exit code 1. */
async function rescoreCommand(environment: Environment, [ats, jobId]: string[]): Promise<number> {
    if (!ats || !jobId) return usage();
    const stores = await openStores(parseDbSettings(environment));
    try {
        return await rescoreWith(environment, stores.forUser(OWNER_ID), { ats, jobId });
    } finally {
        await stores.close();
    }
}

/** Opens a re-score against open stores and records its run, printing each step as it happens, or that one is already running; closes its page renderer afterward. */
async function rescoreWith(environment: Environment, stores: UserStores, key: JobKey): Promise<number> {
    const opened = await openRescore(environment, stores, (line, elapsedMs) => console.log(consoleLine(line, elapsedMs)));
    try {
        const begun = await opened.begin(key);
        if ("running" in begun) console.log(alreadyRunningLine(key, begun.running));
        if (!("started" in begun)) return "missing" in begun ? printed(`rescore ${key.ats} ${key.jobId}: failed`, 1) : 1;
        console.log(commandLine(key));
        const result = await rescore(opened.deps, key);
        return printed(`rescore ${key.ats} ${key.jobId}: ${result.outcome}${result.outcome === "filtered" ? ` (${result.note})` : ""}`, result.outcome === "failed" ? 1 : 0);
    } finally {
        await opened.close();
    }
}

/** Prints a line and gives back an exit code. */
function printed(line: string, code: number): number {
    console.log(line);
    return code;
}

/** Copies an old SQLite database into the configured MariaDB database once, printing the row counts. */
async function importCommand(environment: Environment, [path]: string[]): Promise<number> {
    if (!path) return usage();
    const report = await importSqlite(path, parseDbSettings(environment), OWNER_ID);
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
