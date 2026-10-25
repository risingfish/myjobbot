import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { importSqlite } from "./app/importSqlite.js";
import { runOnce } from "./app/run.js";
import { exportSettings, importSettings } from "./app/settingsCommands.js";
import type { Environment } from "./config/load.js";
import { envSchema } from "./config/schema.js";
import { openStores } from "./db/connect.js";
import { parseDbSettings } from "./db/settings.js";
import type { Stores } from "./db/store.js";
import { describeError } from "./errors.js";

const USAGE = "usage: myjobbot run | import-sqlite <path> | export-settings <path> | import-settings <path>";

type Command = (environment: Environment, args: string[]) => Promise<number>;

const COMMANDS: Record<string, Command> = { run: runCommand, "import-sqlite": importCommand, "export-settings": exportSettingsCommand, "import-settings": importSettingsCommand };

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

/** Writes the owner's stored search settings to a file. */
async function exportSettingsCommand(environment: Environment, [path]: string[]): Promise<number> {
    if (!path) return usage();
    await withStores(environment, (stores) => exportSettings(path, stores.searchSettings));
    console.log(`exported search settings to ${path}`);
    return 0;
}

/** Replaces the owner's stored search settings with a checked file's, printing every reason when it is refused. */
async function importSettingsCommand(environment: Environment, [path]: string[]): Promise<number> {
    if (!path) return usage();
    const refusals = await withStores(environment, (stores) => importSettings(path, envSchema.shape.MYJOBBOT_DATA_DIR.parse(environment.MYJOBBOT_DATA_DIR), stores.searchSettings));
    for (const refusal of refusals) console.error(`myjobbot: ${refusal}`);
    if (refusals.length === 0) console.log(`imported search settings from ${path}`);
    return refusals.length === 0 ? 0 : 1;
}

/** Prints the usage line and returns the exit code for a malformed command. */
function usage(): number {
    console.error(USAGE);
    return 2;
}

/** Opens the configured database's stores for one command and closes them afterward. */
async function withStores<T>(environment: Environment, use: (stores: Stores) => Promise<T>): Promise<T> {
    const stores = await openStores(parseDbSettings(environment));
    try {
        return await use(stores);
    } finally {
        await stores.close();
    }
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
