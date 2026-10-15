import type { MessageHeader } from "./google.js";

export interface AlertSummary {
    from: string;
    subject: string;
    date: string;
}

export const DEFAULT_ALERT_SENDERS = ["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com", "alert@indeed.com", "donotreply@jobalert.indeed.com"];

const EMAIL = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const DOMAIN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/i;

/** Tells whether a configured alert sender is a plain email address or domain, so it can't change the meaning of the Gmail search. */
export function isAlertSender(value: string): boolean {
    return EMAIL.test(value) || DOMAIN.test(value);
}

/** Builds the Gmail search for the last 7 days of mail from the configured alert senders. */
export function alertQuery(senders: string[]): string {
    return `from:(${senders.join(" OR ")}) newer_than:7d`;
}

/** Picks a message's sender, subject and date out of its headers. */
export function summarize(headers: MessageHeader[]): AlertSummary {
    const header = (name: string) => headers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())?.value;
    return { from: header("From") ?? "", subject: header("Subject") ?? "(no subject)", date: header("Date") ?? "" };
}

/** Orders alert summaries newest first, leaving Gmail's order alone where a date can't be read. */
export function newestFirst(alerts: AlertSummary[]): AlertSummary[] {
    return [...alerts].sort((left, right) => {
        const [a, b] = [Date.parse(left.date), Date.parse(right.date)];
        return Number.isNaN(a) || Number.isNaN(b) ? 0 : b - a;
    });
}
