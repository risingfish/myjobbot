import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { runOnce } from "./app/run.js";
import { describeError } from "./errors.js";

const USAGE = "usage: myjobbot run";

async function main(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true });
  if (positionals[0] !== "run") {
    console.error(USAGE);
    return 2;
  }
  if (existsSync(".env")) process.loadEnvFile(".env");
  const report = await runOnce(process.env);
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
