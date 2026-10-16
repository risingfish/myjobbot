import type { Trace } from "../agent/trace.js";
import type { AlertStateRow, AlertStore, GmailStore, JobStore } from "../db/store.js";
import type { MatchStats } from "./alertJobs/lookup.js";
import { parseAlert, type AlertEmail, type ParsedAlert } from "./alertJobs/parse.js";
import { ALERTS_SOURCE } from "./alertJobs/source.js";
import { ALERT_NOTES, AlertsUnavailable, alertsUsability } from "./alertJobs/usable.js";
import { lookUpDescriptions, type LookupDeps, type ReadEmail } from "./alertLookupStep.js";
import { alertJobRecord, sortAlertJobs } from "./alertStore.js";
import { imapApi, type ImapFactory } from "./imap.js";
import type { AlertMail } from "./imapAlerts.js";
import { GmailError } from "./imapErrors.js";
import type { SecretKeyStatus } from "./secretKey.js";

export interface AlertDeps {
    gmail: GmailStore;
    alerts: AlertStore;
    store: JobStore;
    key: SecretKeyStatus;
    imap?: ImapFactory;
    senders: string[];
    trace: Trace;
    now: Date;
    lookup?: LookupDeps;
}

export type { LookupDeps };

export interface AlertSummary {
    emails: number;
    jobs_found: number;
    stored: number;
    seen_again: number;
    searches: number;
    looked_up: number;
    with_description: number;
    alert_only: number;
    not_understood: number;
    unsupported: number;
}

interface Counts {
    stored: number;
    seenAgain: number;
    searches: number;
    lookedUp: number;
    withDescription: number;
    lookups: MatchStats[];
}

const MAX_EMAILS = 50;

/** Reads new job-alert emails into stored jobs, records where reading stopped, and reports what it found. */
export async function fetchAlerts(deps: AlertDeps): Promise<AlertSummary> {
    const marker = await deps.alerts.state();
    const mail = await readMail(deps, marker);
    const read = mail.emails.map((email) => ({ email, alert: safeParse(email) }));
    const counts = await storeRead(deps, read);
    const summary = summarize(read, counts);
    await deps.alerts.recordRead({ uidValidity: mail.uidValidity, lastUid: lastUid(mail, marker), emails: summary.emails, jobs: summary.jobs_found, notUnderstood: summary.not_understood }, deps.now.toISOString());
    deps.trace.write({ type: "alerts", ...summary, lookups: counts.lookups, not_understood: notUnderstood(read).map(({ email, alert }) => ({ from: email.from, subject: email.subject, ...(alert.failure === undefined ? {} : { failure: alert.failure }) })) });
    return summary;
}

/** Stores the jobs a run read, looking up descriptions for the new ones first, and counts the outcome. */
async function storeRead(deps: AlertDeps, read: ReadEmail[]): Promise<Counts> {
    const seen = deps.now.toISOString();
    const sorted = await sortAlertJobs(
        deps.store,
        read.flatMap((entry) => entry.alert.jobs),
        seen,
    );
    const looked = await lookUpDescriptions(deps.lookup, { read, fresh: sorted.fresh, now: deps.now });
    const jobs = sorted.fresh.map((job) => alertJobRecord(job, looked.matches.get(job.linkedinId)));
    await deps.store.upsertAll(jobs, seen, ALERTS_SOURCE);
    return { stored: jobs.length, seenAgain: sorted.seenAgain, searches: looked.searches, lookedUp: looked.lookedUp, withDescription: jobs.filter((job) => job.description !== null).length, lookups: looked.stats };
}

/** Reads unread alert mail, turning an unusable connection or a Gmail failure into a fixed note. */
async function readMail(deps: AlertDeps, marker: AlertStateRow | null): Promise<AlertMail> {
    const access = alertsUsability(await deps.gmail.connection(), deps.key);
    if (!access.usable) throw new AlertsUnavailable(access.note);
    try {
        return await (deps.imap ?? imapApi)({ email: access.email, password: access.password }).readAlerts({ senders: deps.senders, marker, max: MAX_EMAILS });
    } catch (error) {
        if (!(error instanceof GmailError)) throw error;
        if (error.code === "bad_login") await deps.gmail.needsReconnect("app password rejected; create a new one");
        throw new AlertsUnavailable(error.code === "bad_login" ? ALERT_NOTES.needsReconnect : error.code === "unreachable" ? ALERT_NOTES.unreachable : ALERT_NOTES.error);
    }
}

/** Counts what a run read: emails, jobs, and mail that yielded nothing. */
function summarize(read: ReadEmail[], counts: Counts): AlertSummary {
    const jobsFound = read.reduce((total, entry) => total + entry.alert.jobs.length, 0);
    const unsupported = read.filter((entry) => !isLinkedIn(entry.email)).length;
    const looked = { searches: counts.searches, looked_up: counts.lookedUp, with_description: counts.withDescription, alert_only: counts.stored - counts.withDescription };
    return { emails: read.length, jobs_found: jobsFound, stored: counts.stored, seen_again: counts.seenAgain, ...looked, not_understood: notUnderstood(read).length, unsupported };
}

/** Lists LinkedIn emails that yielded no jobs, the signal of a layout change. */
function notUnderstood(read: ReadEmail[]): ReadEmail[] {
    return read.filter((entry) => isLinkedIn(entry.email) && entry.alert.jobs.length === 0);
}

/** Tells whether an email comes from LinkedIn, the only sender with a known layout. */
function isLinkedIn(email: AlertEmail): boolean {
    return email.from.endsWith("@linkedin.com");
}

/** Returns the highest message read, keeping the earlier marker when nothing new arrived in the same folder. */
function lastUid(mail: AlertMail, marker: AlertStateRow | null): number | null {
    const previous = marker?.uid_validity === mail.uidValidity ? marker.last_uid : null;
    return Math.max(previous ?? 0, ...mail.emails.map((email) => email.uid)) || previous;
}

/** Parses one email, treating any failure as an email that yielded no jobs, so one odd email can't stall alert reading for good. */
function safeParse(email: AlertEmail): ParsedAlert {
    try {
        return parseAlert(email);
    } catch (error) {
        return { layout: null, keywords: null, jobs: [], failure: error instanceof Error ? error.name : "unknown" };
    }
}
