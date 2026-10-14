import { spawnSync } from "node:child_process";

export interface CliResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

export function runCli(args: string[], env: Record<string, string> = {}): CliResult {
    const result = spawnSync("node_modules/.bin/tsx", ["src/cli.ts", ...args], {
        encoding: "utf8",
        env: { ...process.env, ...env },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
