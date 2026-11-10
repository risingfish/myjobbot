import type { AgentResult } from "../agent/loop.js";

export interface RunReport extends AgentResult {
    runId: string;
    summary: string | null;
}

export type UserRun = { userId: number; report: RunReport } | { userId: number; skipped: string } | { userId: number; failed: string } | { userId: number; deleted: true } | { userId: number; held: "last_admin" };

/** Gives the command line's line for one user's part of a run, built from its fields alone. */
export function runLine(run: UserRun): string {
    const prefix = `user ${run.userId}: `;
    if ("report" in run) return `${prefix}run ${run.report.runId} ${run.report.status} after ${run.report.steps} steps: ${run.report.reason}`;
    if ("deleted" in run) return `${prefix}deleted`;
    if ("held" in run) return `${prefix}deletion held (last admin)`;
    return "skipped" in run ? `${prefix}skipped (${run.skipped})` : `${prefix}failed`;
}

/** Maps a run's users to its exit code: 1 when any failed or didn't finish, or when the one user asked for was skipped. */
export function runExitCode(runs: UserRun[], only: number | undefined): number {
    const bad = runs.some((run) => "failed" in run || ("report" in run && run.report.status !== "finished") || ("skipped" in run && run.userId === only));
    return bad ? 1 : 0;
}
