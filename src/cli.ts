import { parseArgs } from "node:util";

const USAGE = "usage: myjobbot run";

async function main(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true });
  if (positionals[0] !== "run") {
    console.error(USAGE);
    return 2;
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
