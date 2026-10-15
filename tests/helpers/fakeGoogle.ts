import type { AuthUrlOptions } from "../../src/gmail/connectRequest.js";
import type { GoogleApi, GoogleFactory } from "../../src/gmail/google.js";

type GoogleClient = Parameters<GoogleFactory>[0];
type GrantResult = Awaited<ReturnType<GoogleApi["exchange"]>>;

export interface FakeScript {
    exchange?: () => Promise<GrantResult>;
    ids?: string[];
    pageSize?: number;
    failList?: Error;
    failRevoke?: Error;
}

export interface FakeGoogle {
    factory: GoogleFactory;
    clients: GoogleClient[];
    authOptions: AuthUrlOptions[];
    exchanges: Array<[string, string]>;
    pages: Array<string | null>;
    headersFor: string[];
    revoked: string[];
}

function listing(script: FakeScript, fake: FakeGoogle): GoogleApi["messagePage"] {
    return async (_token, _query, pageToken) => {
        if (script.failList) throw script.failList;
        fake.pages.push(pageToken);
        const ids = script.ids ?? [];
        const start = Number(pageToken ?? 0);
        const end = start + (script.pageSize ?? 500);
        return { ids: ids.slice(start, end), next: end < ids.length ? String(end) : null };
    };
}

function signIn(script: FakeScript, fake: FakeGoogle): Pick<GoogleApi, "authUrl" | "exchange"> {
    return {
        authUrl: (options) => {
            fake.authOptions.push(options);
            return `https://accounts.example/auth?state=${options.state}`;
        },
        exchange: async (code, verifier) => {
            fake.exchanges.push([code, verifier]);
            return (script.exchange ?? (async () => ({ refreshToken: "refresh-1", email: "me@example.com" })))();
        },
    };
}

function mailbox(script: FakeScript, fake: FakeGoogle): Pick<GoogleApi, "messageHeaders" | "revoke"> {
    return {
        messageHeaders: async (_token, id) => {
            fake.headersFor.push(id);
            return [
                { name: "Subject", value: `alert ${id}` },
                { name: "From", value: "jobs@example.com" },
                { name: "Date", value: "Wed, 15 Oct 2026 09:00:00 +0000" },
            ];
        },
        revoke: async (token) => {
            if (script.failRevoke) throw script.failRevoke;
            fake.revoked.push(token);
        },
    };
}

export function fakeGoogle(script: FakeScript = {}): FakeGoogle {
    const fake: FakeGoogle = { factory: () => api, clients: [], authOptions: [], exchanges: [], pages: [], headersFor: [], revoked: [] };
    const api: GoogleApi = { ...signIn(script, fake), messagePage: listing(script, fake), ...mailbox(script, fake) };
    fake.factory = (client) => {
        fake.clients.push(client);
        return api;
    };
    return fake;
}
