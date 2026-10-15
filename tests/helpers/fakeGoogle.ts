import type { AuthUrlOptions } from "../../src/gmail/connectRequest.js";
import type { GoogleApi, GoogleFactory } from "../../src/gmail/google.js";

type GoogleClient = Parameters<GoogleFactory>[0];
type GrantResult = Awaited<ReturnType<GoogleApi["exchange"]>>;

export interface FakeGoogle {
    factory: GoogleFactory;
    clients: GoogleClient[];
    authOptions: AuthUrlOptions[];
    exchanges: Array<[string, string]>;
}

export function fakeGoogle(exchange: () => Promise<GrantResult> = async () => ({ refreshToken: "refresh-1", email: "me@example.com" })): FakeGoogle {
    const fake: FakeGoogle = { factory: () => api, clients: [], authOptions: [], exchanges: [] };
    const api: GoogleApi = {
        authUrl: (options) => {
            fake.authOptions.push(options);
            return `https://accounts.example/auth?state=${options.state}`;
        },
        exchange: async (code, verifier) => {
            fake.exchanges.push([code, verifier]);
            return exchange();
        },
    };
    fake.factory = (client) => {
        fake.clients.push(client);
        return api;
    };
    return fake;
}
