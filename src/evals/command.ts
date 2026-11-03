import { envSchema } from "../config/schema.js";
import type { Environment } from "../config/load.js";
import { checkEvals } from "./check.js";
import { EvalFiles } from "./files.js";
import { nodeFilePort } from "./filePort.js";

const USAGE = "usage: myjobbot eval check";

type Subcommand = (files: EvalFiles, args: string[]) => Promise<number>;

const SUBCOMMANDS: Record<string, Subcommand> = { check: checkCommand };

/** Runs one `eval` subcommand against the eval files in the data folder, returning the process exit code. */
export async function evalCommand(environment: Environment, args: string[]): Promise<number> {
    const [name = "", ...rest] = args;
    const subcommand = SUBCOMMANDS[name];
    if (!subcommand) {
        console.error(USAGE);
        return 2;
    }
    const root = envSchema.shape.MYJOBBOT_DATA_DIR.parse(environment.MYJOBBOT_DATA_DIR);
    return subcommand(new EvalFiles(nodeFilePort(root)), rest);
}

/** Prints how many eval files of each kind there are and every bad one, failing when any is bad. */
async function checkCommand(files: EvalFiles): Promise<number> {
    const { lines, code } = await checkEvals(files);
    for (const line of lines) console.log(line);
    return code;
}
