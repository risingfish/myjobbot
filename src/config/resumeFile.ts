import { OWNER_ID } from "../db/searchSettingsStore.js";

/** Says whether the deployment's resume file (data/resume.md) is this user's: it is the owner's, user 1's, and no one else's. */
export function ownsResumeFile(userId: number): boolean {
    return userId === OWNER_ID;
}
