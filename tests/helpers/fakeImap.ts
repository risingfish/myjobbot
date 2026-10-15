import type { ImapApi, ImapFactory } from "../../src/gmail/imap.js";

type Credentials = Parameters<ImapFactory>[0];

export interface FakeImapScript {
    uids?: number[];
    fail?: Error;
}

export interface FakeImap {
    factory: ImapFactory;
    sessions: Credentials[];
    queries: string[];
    fetched: number[][];
}

export function fakeImap(script: FakeImapScript = {}): FakeImap {
    const fake: FakeImap = { factory: () => api, sessions: [], queries: [], fetched: [] };
    const api: ImapApi = {
        verify: async () => {
            if (script.fail) throw script.fail;
        },
        lookup: async (query, pick) => {
            if (script.fail) throw script.fail;
            fake.queries.push(query);
            const chosen = pick(script.uids ?? []);
            fake.fetched.push(chosen);
            return { count: (script.uids ?? []).length, envelopes: chosen.map((uid) => ({ from: [{ name: "Jobs", address: "jobs@example.com" }], subject: `alert ${uid}`, date: new Date(Date.UTC(2026, 9, 1, 0, uid % 60)) })) };
        },
    };
    fake.factory = (credentials) => {
        fake.sessions.push(credentials);
        return api;
    };
    return fake;
}
