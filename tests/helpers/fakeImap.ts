import type { AlertEmail } from "../../src/gmail/alertJobs/parse.js";
import { alertSearch, unreadUids } from "../../src/gmail/alertJobs/read.js";
import type { ImapApi, ImapFactory } from "../../src/gmail/imap.js";
import type { ReadAlertsRequest } from "../../src/gmail/imapAlerts.js";

type Credentials = Parameters<ImapFactory>[0];

export interface FakeImapScript {
    uids?: number[];
    fail?: Error;
    mailbox?: { uidValidity: number; emails: AlertEmail[] };
}

export interface FakeImap {
    factory: ImapFactory;
    sessions: Credentials[];
    queries: string[];
    fetched: number[][];
    reads: ReadAlertsRequest[];
}

function reader(script: FakeImapScript, fake: FakeImap): ImapApi["readAlerts"] {
    return async (request) => {
        if (script.fail) throw script.fail;
        fake.reads.push(request);
        const mailbox = script.mailbox ?? { uidValidity: 1, emails: [] };
        const { sinceUid } = alertSearch({ senders: request.senders, marker: request.marker, uidValidity: mailbox.uidValidity });
        const kept = new Set(
            unreadUids(
                mailbox.emails.map((email) => email.uid),
                sinceUid,
                request.max,
            ),
        );
        return { uidValidity: mailbox.uidValidity, emails: mailbox.emails.filter((email) => kept.has(email.uid)) };
    };
}

function looker(script: FakeImapScript, fake: FakeImap): ImapApi["lookup"] {
    return async (query, pick) => {
        if (script.fail) throw script.fail;
        fake.queries.push(query);
        const chosen = pick(script.uids ?? []);
        fake.fetched.push(chosen);
        return { count: (script.uids ?? []).length, envelopes: chosen.map((uid) => ({ from: [{ name: "Jobs", address: "jobs@example.com" }], subject: `alert ${uid}`, date: new Date(Date.UTC(2026, 9, 1, 0, uid % 60)) })) };
    };
}

export function fakeImap(script: FakeImapScript = {}): FakeImap {
    const fake: FakeImap = { factory: () => api, sessions: [], queries: [], fetched: [], reads: [] };
    const api: ImapApi = {
        verify: async () => {
            if (script.fail) throw script.fail;
        },
        lookup: looker(script, fake),
        readAlerts: reader(script, fake),
    };
    fake.factory = (credentials) => {
        fake.sessions.push(credentials);
        return api;
    };
    return fake;
}
