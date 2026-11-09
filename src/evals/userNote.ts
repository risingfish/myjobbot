import type { EvalCase, Run } from "./format.js";

/** Gives the note warning that two compared runs were scored for different users, or that one's user wasn't recorded, or null when they match. */
export function runsNote(a: Run, b: Run): string | null {
    if (a.userId === undefined || b.userId === undefined) return "note: a run's user wasn't recorded, so the users can't be checked";
    if (a.userId === b.userId) return null;
    const [low, high] = [a.userId, b.userId].sort((x, y) => x - y);
    return `note: these runs were scored for different users (${low} and ${high})`;
}

/** Gives the note warning that a run compared with production's scores was scored for another user than a case was captured from, or that a user wasn't recorded, or null when they all match. */
export function observedNote(run: Run, cases: EvalCase[]): string | null {
    if (run.userId === undefined || cases.some((each) => each.userId === undefined)) return "note: a run's or case's user wasn't recorded, so the users can't be checked";
    return cases.some((each) => each.userId !== run.userId) ? "note: some cases were captured from another user's scores" : null;
}

/** Names a run's user by account id, or says it wasn't recorded, in the words reports use. */
export function userText(run: Run): string {
    return run.userId === undefined ? "user not recorded" : `user ${run.userId}`;
}
