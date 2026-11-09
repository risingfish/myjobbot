import { describeError } from "../errors.js";
import { loadConfig, type Environment, type LoadedConfig } from "../config/load.js";
import { runtimeSettings } from "../config/resolve.js";
import { openStores } from "../db/connect.js";
import { parseDbSettings } from "../db/settings.js";
import type { Stores } from "../db/store.js";
import { secretKeyStatus, type SecretKeyStatus } from "../secrets/secretKey.js";
import { MS_PER_DAY } from "../jobs/age.js";
import { runForUser, type RunSeams } from "./run.js";
import type { UserRun } from "./runLines.js";
import { usersToRun, type PlannedUser, type UserFacts } from "./usersToRun.js";

interface RunAllParts {
    loaded: LoadedConfig;
    seams: RunSeams;
    stores: Stores;
    key: SecretKeyStatus;
}

/** Runs every user, or only the one asked for, one after another in id order, then prunes stale postings once, reporting each user's part. */
export async function runAll(environment: Environment, seams: RunSeams, only?: number): Promise<UserRun[]> {
    const loaded = loadConfig(environment);
    const stores = await (seams.openStores ?? (() => openStores(parseDbSettings(environment))))();
    try {
        const parts = { loaded, seams, stores, key: secretKeyStatus(environment) };
        const runs: UserRun[] = [];
        for (const user of usersToRun(await userFacts(stores, loaded, only))) runs.push(await runPlanned(parts, user));
        await pruneOldJobs(stores, loaded);
        return runs;
    } finally {
        await stores.close();
    }
}

/** Gathers what deciding whether to run each user needs: their sources that are on and the resume they can use. */
async function userFacts(stores: Stores, loaded: LoadedConfig, only: number | undefined): Promise<UserFacts[]> {
    const ids = only === undefined ? await stores.accounts.userIds() : [only];
    const on = await stores.sourcePlans.sourcesOnForAll();
    return Promise.all(ids.map(async (userId) => ({ userId, sourcesOn: on.filter((source) => source.userId === userId).length, uploadedResume: (await stores.forUser(userId).resume.currentResume()) !== null, resumeFile: loaded.resume !== null })));
}

/** Runs one planned user, reporting a skip as planned and a failure without stopping the users after them. */
async function runPlanned({ loaded, seams, stores, key }: RunAllParts, user: PlannedUser): Promise<UserRun> {
    if ("skipped" in user) return user;
    try {
        return { userId: user.userId, report: await runForUser(loaded, seams, { stores: stores.forUser(user.userId), key }) };
    } catch (error) {
        return { userId: user.userId, failed: describeError(error) };
    }
}

/** Deletes postings, API call records and careers audit rows older than the deployment's retention window. */
async function pruneOldJobs(stores: Stores, loaded: LoadedConfig): Promise<void> {
    const cutoff = new Date(Date.now() - runtimeSettings(loaded.fileRaw).job_retention_days * MS_PER_DAY).toISOString();
    await stores.postings.prune(cutoff);
    await stores.apiCalls.pruneBefore(cutoff);
    await stores.careers.pruneAuditBefore(cutoff);
}
