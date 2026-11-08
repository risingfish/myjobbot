import { ownsResumeFile } from "../config/resumeFile.js";

export interface UserFacts {
    userId: number;
    sourcesOn: number;
    uploadedResume: boolean;
    resumeFile: boolean;
}

export type PlannedUser = { userId: number; run: true } | { userId: number; skipped: string };

export const NO_SOURCES = "no sources are on";

/** Decides, in id order, which users a run scores for and why each other user is skipped. */
export function usersToRun(facts: UserFacts[]): PlannedUser[] {
    return [...facts].sort((a, b) => a.userId - b.userId).map(planFor);
}

/** Plans one user: skipped with no source on or no resume they can use, else run. */
function planFor(user: UserFacts): PlannedUser {
    if (user.sourcesOn === 0) return { userId: user.userId, skipped: NO_SOURCES };
    if (!user.uploadedResume && !(user.resumeFile && ownsResumeFile(user.userId))) return { userId: user.userId, skipped: "no resume" };
    return { userId: user.userId, run: true };
}
