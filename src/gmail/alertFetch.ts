import type { Trace } from "../agent/trace.js";
import type { AlertStateRow, AlertStore, GmailStore, JobStore } from "../db/store.js";
import { parseAlert, type AlertEmail, type ParsedAlert } from "./alertJobs/parse.js";
import { ALERT_NOTES, AlertsUnavailable, alertsUsability } from "./alertJobs/usable.js";
import { storeAlertJobs } from "./alertStore.js";
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
}

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

interface ReadEmail {
    email: AlertEmail;
    alert: ParsedAlert;
}

const MAX_EMAILS = 50;

/** Reads new job-alert emails into stored jobs, records where reading stopped, and reports what it found. */
export async function fetchAlerts(deps: AlertDeps): Promise<AlertSummary> {
    const marker = await deps.alerts.state();
    const mail = await readMail(deps, marker);
    const read = mail.emails.map((email) => ({ email, alert: parseAlert(email) }));
    const result = await storeAlertJobs(
        deps.store,
        read.flatMap((entry) => entry.alert.jobs),
        deps.now.toISOString(),
    );
    const summary = summarize(read, { stored: result.stored.length, seenAgain: result.seenAgain, alertOnly: result.stored.filter((job) => job.description === null).length });
    await deps.alerts.recordRead({ uidValidity: mail.uidValidity, lastUid: lastUid(mail, marker), emails: summary.emails, jobs: summary.jobs_found, notUnderstood: summary.not_understood }, deps.now.toISOString());
    deps.trace.write({ type: "alerts", ...summary, not_understood: notUnderstood(read).map(({ email }) => ({ from: email.from, subject: email.subject })) });
    return summary;
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
function summarize(read: ReadEmail[], counts: { stored: number; seenAgain: number; alertOnly: number }): AlertSummary {
    const jobsFound = read.reduce((total, entry) => total + entry.alert.jobs.length, 0);
    const unsupported = read.filter((entry) => !isLinkedIn(entry.email)).length;
    return { emails: read.length, jobs_found: jobsFound, stored: counts.stored, seen_again: counts.seenAgain, searches: 0, looked_up: 0, with_description: 0, alert_only: counts.alertOnly, not_understood: notUnderstood(read).length, unsupported };
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
