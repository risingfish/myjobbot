import type { Trace } from "../agent/trace.js";
import { settingsForRun } from "../app/runSettings.js";
import { loadConfig, type Environment } from "../config/load.js";
import { envSchema } from "../config/schema.js";
import { openStores } from "../db/connect.js";
import { parseDbSettings } from "../db/settings.js";
import { answerKeyCommand } from "./answerKey.js";
import { captureCases } from "./captureCommand.js";
import { checkEvals } from "./check.js";
import { EvalFiles } from "./files.js";
import { nodeFilePort, type FilePort } from "./filePort.js";

const USAGE = "usage: myjobbot eval check | capture <ats> <job_id> | capture --recent <N> | answer-key <case-id> <verdict>";
const UNTRACED: Trace = { write: () => {} };

interface Context {
    environment: Environment;
    files: EvalFiles;
    port: FilePort;
}

type Subcommand = (context: Context, args: string[]) => Promise<number>;

const SUBCOMMANDS: Record<string, Subcommand> = { check: checkCommand, capture: captureCommand, "answer-key": ({ files }, args) => answerKeyCommand(args, { files, now: () => new Date(), print: (line) => console.log(line) }) };

/** Runs one `eval` subcommand against the eval files in the data folder, returning the process exit code. */
export async function evalCommand(environment: Environment, args: string[]): Promise<number> {
    const [name = "", ...rest] = args;
    const subcommand = SUBCOMMANDS[name];
    if (!subcommand) {
        console.error(USAGE);
        return 2;
    }
    const port = nodeFilePort(envSchema.shape.MYJOBBOT_DATA_DIR.parse(environment.MYJOBBOT_DATA_DIR));
    return subcommand({ environment, files: new EvalFiles(port), port }, rest);
}

/** Prints how many eval files of each kind there are and every bad one, failing when any is bad. */
async function checkCommand({ files }: Context): Promise<number> {
    const { lines, code } = await checkEvals(files);
    for (const line of lines) console.log(line);
    return code;
}

/** Captures stored jobs as cases, with the resume and settings resolved as a run resolves them, and closes the database after. */
async function captureCommand({ environment, files, port }: Context, args: string[]): Promise<number> {
    const stores = await openStores(parseDbSettings(environment));
    try {
        const config = await settingsForRun(loadConfig(environment), stores.searchSettings, UNTRACED);
        return await captureCases(args, { stores, files, port, config, now: () => new Date(), print: (line) => console.log(line) });
    } finally {
        await stores.close();
    }
}
