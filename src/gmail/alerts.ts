export interface Envelope {
    from?: Array<{ name?: string; address?: string }>;
    subject?: string;
    date?: Date | string;
}

export interface AlertSummary {
    from: string;
    subject: string;
    date: string;
}

export const DEFAULT_ALERT_SENDERS = ["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com", "alert@indeed.com", "donotreply@jobalert.indeed.com"];

const NEWEST = 5;
const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const DOMAIN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/i;

/** Tells whether a configured alert sender is a plain email address or domain, so it can't change the meaning of the Gmail search. */
export function isAlertSender(value: string): boolean {
    return EMAIL.test(value) || DOMAIN.test(value);
}

/** Builds the Gmail search for the last 7 days of mail from the configured alert senders. */
export function alertQuery(senders: string[]): string {
    return `${senderQuery(senders)} newer_than:7d`;
}

/** Builds the part of a Gmail search that matches mail from any of the alert senders. */
export function senderQuery(senders: string[]): string {
    return `from:(${senders.join(" OR ")})`;
}

/** Turns a message's envelope into the sender, subject and date the panel lists. */
export function summarize(envelope: Envelope): AlertSummary {
    const date = envelope.date instanceof Date ? envelope.date.toISOString() : (envelope.date ?? "");
    return { from: senderText(envelope.from?.[0] ?? {}), subject: envelope.subject ?? "(no subject)", date };
}

/** Formats a sender as "Name <address>", or whichever of the two is known. */
function senderText(sender: { name?: string; address?: string }): string {
    if (sender.name && sender.address) return `${sender.name} <${sender.address}>`;
    return sender.address ?? sender.name ?? "";
}

/** Picks the newest messages: IMAP gives later mail higher UIDs. */
export function newestUids(uids: number[]): number[] {
    return [...uids].sort((left, right) => right - left).slice(0, NEWEST);
}

/** Orders alert summaries newest first, leaving Gmail's order alone where a date can't be read. */
export function newestFirst(alerts: AlertSummary[]): AlertSummary[] {
    return [...alerts].sort((left, right) => {
        const [a, b] = [Date.parse(left.date), Date.parse(right.date)];
        return Number.isNaN(a) || Number.isNaN(b) ? 0 : b - a;
    });
}
