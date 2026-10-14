import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { runOnce } from "./app/run.js";
import type { Environment } from "./config/load.js";
import { describeError } from "./errors.js";

const USAGE = "usage: myjobbot run";

type Command = (environment: Environment) => Promise<number>;

const COMMANDS: Record<string, Command> = { run: runCommand };

/** Parses argv and dispatches to the matching subcommand, returning the process exit code. */
async function main(argv: string[]): Promise<number> {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true });
    const command = COMMANDS[positionals[0] ?? ""];
    if (!command) {
        console.error(USAGE);
        return 2;
    }
    if (existsSync(".env")) process.loadEnvFile(".env");
    return command(process.env);
}

/** Runs one agent session, prints its outcome, and maps the result to an exit code. */
async function runCommand(environment: Environment): Promise<number> {
    const report = await runOnce(environment);
    console.log(`run ${report.runId} ${report.status} after ${report.steps} steps: ${report.reason}`);
    if (report.summary) console.log(report.summary);
    return report.status === "finished" ? 0 : 1;
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
