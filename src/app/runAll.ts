import { randomUUID } from "node:crypto";
import { describeError } from "../errors.js";
import { runFailureReason } from "../monitoring/failureReason.js";
import { RunRecorder } from "../monitoring/recorder.js";
import { MONITORING_RETENTION_DAYS } from "../monitoring/retention.js";
import { RunTally } from "../monitoring/tally.js";
import { loadConfig, type Environment, type LoadedConfig } from "../config/load.js";
import { runtimeSettings } from "../config/resolve.js";
import { openStores } from "../db/connect.js";
import { parseDbSettings } from "../db/settings.js";
import type { Stores } from "../db/store.js";
import { secretKeyStatus, type SecretKeyStatus } from "../secrets/secretKey.js";
import { MS_PER_DAY } from "../jobs/age.js";
import type { MailMessage } from "../mail/mailer.js";
import { mailSlot } from "../mail/fromEnv.js";
import { sendMail } from "../mail/queue.js";
import { parseBaseUrl } from "../web/security/baseUrl.js";
import { carryOutDeletions } from "./accountDeletions.js";
import { runForUser, type RunSeams } from "./run.js";
import type { UserRun } from "./runLines.js";
import { usersToRun, type PlannedUser, type UserFacts } from "./usersToRun.js";

interface RunAllParts {
    loaded: LoadedConfig;
    seams: RunSeams;
    stores: Stores;
    key: SecretKeyStatus;
    recorder: RunRecorder;
}

const NO_TALLY = new RunTally().totals();

/** Carries out the deletions that are due, then runs every user, or only the one asked for, one after another in id order, then prunes stale postings once, recording the run and each part as it goes. */
export async function runAll(environment: Environment, seams: RunSeams, only?: number): Promise<UserRun[]> {
    const loaded = loadConfig(environment);
    const stores = await (seams.openStores ?? (() => openStores(parseDbSettings(environment))))();
    const recorder = new RunRecorder(stores.runHistory, randomUUID());
    try {
        await recorder.begin();
        const runs = await runEveryone({ loaded, seams, stores, key: secretKeyStatus(environment), recorder }, environment, only);
        await pruneOldJobs(stores, loaded);
        await recorder.end();
        return runs;
    } catch (error) {
        await recorder.fail(error);
        throw error;
    } finally {
        await stores.close();
    }
}

/** Carries out the due deletions, then runs each planned user, recording each part. */
async function runEveryone(parts: RunAllParts, environment: Environment, only: number | undefined): Promise<UserRun[]> {
    const { stores, recorder } = parts;
    const runs: UserRun[] = await carryOutDeletions({ removal: stores.removal, accounts: stores.accounts, send: deletionMail(environment, stores) }, new Date().toISOString());
    for (const run of runs) await recorder.partEnded(null, run, NO_TALLY);
    const deleted = new Set(runs.map((run) => run.userId));
    const facts = (await userFacts(stores, parts.loaded, only)).filter((user) => !deleted.has(user.userId));
    for (const user of usersToRun(facts)) runs.push(await runPlanned(parts, user));
    return runs;
}

/** Gives how a run tells a deleted account it is gone: through account mail, recorded in the mail log and waited for, or not at all when mail is off. */
function deletionMail(environment: Environment, stores: Pick<Stores, "mailLog">): (message: MailMessage) => Promise<void> {
    const base = parseBaseUrl(environment);
    const slot = mailSlot(environment, base.ok ? base.url.origin : null, stores.mailLog);
    return slot === null ? async () => {} : (message) => sendMail(slot.mailer, message);
}

/** Gathers what deciding whether to run each user needs: their sources that are on and the resume they can use. */
async function userFacts(stores: Stores, loaded: LoadedConfig, only: number | undefined): Promise<UserFacts[]> {
    const ids = only === undefined ? await stores.accounts.userIds() : [only];
    const on = await stores.sourcePlans.sourcesOnForAll();
    return Promise.all(ids.map(async (userId) => ({ userId, sourcesOn: on.filter((source) => source.userId === userId).length, uploadedResume: (await stores.forUser(userId).resume.currentResume()) !== null, resumeFile: loaded.resume !== null, deactivated: await isDeactivated(stores, userId) })));
}

/** Says whether a user's account is deactivated now, so a run does no work for them. */
async function isDeactivated(stores: Stores, userId: number): Promise<boolean> {
    return ((await stores.accounts.account(userId))?.deactivatedAt ?? null) !== null;
}

/** Runs one planned user as a recorded part, stored as running before any of its work, or records the skip it was planned as. */
async function runPlanned(parts: RunAllParts, user: PlannedUser): Promise<UserRun> {
    if ("skipped" in user) {
        await parts.recorder.partEnded(null, user, NO_TALLY);
        return user;
    }
    const part = { id: randomUUID(), observer: new RunTally() };
    const started = await parts.recorder.partStarted(user.userId, part.id);
    const run = await runOne(parts, user.userId, part);
    await parts.recorder.partEnded(started, run, part.observer.totals());
    return run;
}

/** Runs one user, reporting a skip found at their turn and a failure without stopping the users after them. */
async function runOne({ loaded, seams, stores, key }: RunAllParts, userId: number, part: { id: string; observer: RunTally }): Promise<UserRun> {
    try {
        if (await isDeactivated(stores, userId)) return { userId, skipped: "deactivated" };
        return { userId, report: await runForUser(loaded, seams, { stores: stores.forUser(userId), key, part }) };
    } catch (error) {
        return { userId, failed: describeError(error), reason: runFailureReason(error) };
    }
}

/** Deletes postings, API call records and careers audit rows older than the deployment's retention window, and the run, fetch and mail history older than its own. */
async function pruneOldJobs(stores: Stores, loaded: LoadedConfig): Promise<void> {
    const cutoff = new Date(Date.now() - runtimeSettings(loaded.fileRaw).job_retention_days * MS_PER_DAY).toISOString();
    await stores.postings.prune(cutoff);
    await stores.apiCalls.pruneBefore(cutoff);
    await stores.careers.pruneAuditBefore(cutoff);
    const historyCutoff = new Date(Date.now() - MONITORING_RETENTION_DAYS * MS_PER_DAY).toISOString();
    await stores.runHistory.pruneBefore(historyCutoff);
    await stores.fetchHistory.pruneBefore(historyCutoff);
    await stores.mailLog.pruneBefore(historyCutoff);
}
