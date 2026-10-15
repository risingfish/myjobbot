import { ImapFlow } from "imapflow";
import type { Envelope } from "./alerts.js";
import { guarded } from "./imapErrors.js";

interface MailboxLogin {
    email: string;
    password: string;
}

interface Lookup {
    count: number;
    envelopes: Envelope[];
}

export interface ImapApi {
    verify(): Promise<void>;
    lookup(query: string, pick: (uids: number[]) => number[]): Promise<Lookup>;
}

export type ImapFactory = (login: MailboxLogin) => ImapApi;

const SERVER = { host: "imap.gmail.com", port: 993, secure: true } as const;
const ALL_MAIL = "\\All";

/** Talks to Gmail over IMAP for one address and app password: proving they work, and searching mail read-only. */
export function imapApi(login: MailboxLogin): ImapApi {
    return {
        verify: () => guarded(() => session(login, async () => undefined)),
        lookup: (query, pick) => guarded(() => session(login, (client) => search(client, { query, pick }))),
    };
}

/** Signs in, runs one piece of work, and always closes the connection, with the library's logging off. */
async function session<T>(login: MailboxLogin, work: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = new ImapFlow({ ...SERVER, auth: { user: login.email, pass: login.password }, logger: false });
    try {
        await client.connect();
        const result = await work(client);
        await client.logout();
        return result;
    } finally {
        client.close();
    }
}

/** Searches All Mail read-only with Gmail's own query syntax, fetching envelopes only for the messages picked. */
async function search(client: ImapFlow, request: { query: string; pick: (uids: number[]) => number[] }): Promise<Lookup> {
    const lock = await client.getMailboxLock(await allMailPath(client), { readOnly: true });
    try {
        const uids = (await client.search({ gmraw: request.query }, { uid: true })) || [];
        const chosen = request.pick(uids);
        const messages = chosen.length === 0 ? [] : await client.fetchAll(chosen, { envelope: true }, { uid: true });
        return { count: uids.length, envelopes: messages.map((message) => message.envelope ?? {}) };
    } finally {
        lock.release();
    }
}

/** Finds Gmail's All Mail folder, whose name depends on the account's language, falling back to the inbox. */
async function allMailPath(client: ImapFlow): Promise<string> {
    const folders = await client.list();
    return folders.find((folder) => folder.specialUse === ALL_MAIL)?.path ?? "INBOX";
}
