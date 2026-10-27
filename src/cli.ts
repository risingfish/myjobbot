import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { importSqlite } from "./app/importSqlite.js";
import { runOnce } from "./app/run.js";
import type { Environment } from "./config/load.js";
import { parseDbSettings } from "./db/settings.js";
import { describeError } from "./errors.js";

const USAGE = "usage: myjobbot run | import-sqlite <path>";

type Command = (environment: Environment, args: string[]) => Promise<number>;

const COMMANDS: Record<string, Command> = { run: runCommand, "import-sqlite": importCommand };

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
