import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { runOnce } from "./app/run.js";
import { startUi } from "./app/serve.js";
import { describeError } from "./errors.js";

const USAGE = "usage: myjobbot run | serve";

type Command = (environment: NodeJS.ProcessEnv) => Promise<number>;

const COMMANDS: Record<string, Command> = { run: runCommand, serve: serveCommand };

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

async function runCommand(environment: NodeJS.ProcessEnv): Promise<number> {
  const report = await runOnce(environment);
  console.log(`run ${report.runId} ${report.status} after ${report.steps} steps: ${report.reason}`);
  if (report.summary) console.log(report.summary);
  return report.status === "finished" ? 0 : 1;
}

function serveCommand(environment: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => startUi(environment).on("close", () => resolve(0)));
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
