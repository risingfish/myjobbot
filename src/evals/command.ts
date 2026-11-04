import type { Trace } from "../agent/trace.js";
import { settingsForRun } from "../app/runSettings.js";
import { loadConfig, type Environment } from "../config/load.js";
import { envSchema } from "../config/schema.js";
import { openStores } from "../db/connect.js";
import { parseDbSettings } from "../db/settings.js";
import { execFileSync } from "node:child_process";
import { createChat } from "../agent/llm.js";
import { answerKeyCommand } from "./answerKey.js";
import { captureCases } from "./captureCommand.js";
import { checkEvals } from "./check.js";
import { EvalFiles } from "./files.js";
import { nodeFilePort, type FilePort } from "./filePort.js";
import { reportCommand } from "./reportCommand.js";
import { runCases, type RunDeps } from "./runCases.js";
import { runSeries, saveSeries } from "./series.js";
import { seriesReport } from "./seriesReport.js";
import { ExperimentFiles } from "./experimentFiles.js";
import { promptCommand } from "./variantCommand.js";

const USAGE = "usage: myjobbot eval check | capture <ats> <job_id> | capture --recent <N> | answer-key <case-id> <verdict> | run [--tag t] [--case id] [--repeats N] [--model name] | report <run-id> [--against <run-id>|observed] [--reasons] | prompt export|diff | series save|run|report";
const UNTRACED: Trace = { write: () => {} };

interface Context {
    environment: Environment;
    files: EvalFiles;
    port: FilePort;
}

type Subcommand = (context: Context, args: string[]) => Promise<number>;

const SUBCOMMANDS: Record<string, Subcommand> = { check: checkCommand, capture: captureCommand, run: runCommand, series: seriesCommand, prompt: ({ port }, args) => promptCommand(args, { experiments: new ExperimentFiles(port), now: () => new Date(), gitCommit, print: (line) => console.log(line) }), report: ({ files }, args) => reportCommand(args, { files, print: (line) => console.log(line) }), "answer-key": ({ files }, args) => answerKeyCommand(args, { files, now: () => new Date(), print: (line) => console.log(line) }) };

/** Runs one `eval` subcommand against the eval files in the data folder, returning the process exit code. */
export async function evalCommand(environment: Environment, args: string[]): Promise<number> {
    const [name = "", ...rest] = args;
    const subcommand = SUBCOMMANDS[name];
    if (!subcommand) return printedUsage();
    const port = nodeFilePort(envSchema.shape.MYJOBBOT_DATA_DIR.parse(environment.MYJOBBOT_DATA_DIR));
    return subcommand({ environment, files: new EvalFiles(port), port }, rest);
}

/** Prints how many eval files of each kind there are and every bad one, failing when any is bad. */
async function checkCommand({ files, port }: Context): Promise<number> {
    const { lines, code } = await checkEvals(files, new ExperimentFiles(port));
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

/** Scores the chosen cases against the real model; reads the database only for the settings. */
function runCommand(context: Context, args: string[]): Promise<number> {
    return withRunDeps(context, (deps) => runCases(args, deps));
}

/** Saves, runs or reports a series of tests; only running one opens the database, for the settings. */
function seriesCommand(context: Context, args: string[]): Promise<number> {
    const [name = "", ...rest] = args;
    const print = (line: string) => console.log(line);
    if (name === "save") return saveSeries(rest, { files: context.files, now: () => new Date(), print });
    if (name === "report") return seriesReport(rest, { files: context.files, print });
    if (name === "run" && rest.length === 1) return withRunDeps(context, (deps) => runSeries(rest[0] ?? "", deps));
    return Promise.resolve(printedUsage());
}

/** Gives a run what it needs, with the resume and settings resolved as a run resolves them, and closes the database after. */
async function withRunDeps({ environment, files, port }: Context, use: (deps: RunDeps) => Promise<number>): Promise<number> {
    const stores = await openStores(parseDbSettings(environment));
    try {
        const config = await settingsForRun(loadConfig(environment), stores.searchSettings, UNTRACED);
        const chatFor = (model: string) => (log: Trace) => createChat({ ...config.env, LLM_MODEL: model }, log);
        return await use({ files, experiments: new ExperimentFiles(port), config, chatFor, now: () => new Date(), random: Math.random, gitCommit, print: (line) => console.log(line) });
    } finally {
        await stores.close();
    }
}

/** Prints the eval usage line and gives the usage exit code. */
function printedUsage(): number {
    console.error(USAGE);
    return 2;
}

/** Reads the checked-out commit, or null where there is no git, as in the container. */
function gitCommit(): string | null {
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return null;
    }
}
