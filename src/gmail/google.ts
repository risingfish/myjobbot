import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import type { AuthUrlOptions } from "./connectRequest.js";
import { GoogleError, guarded } from "./googleErrors.js";

interface GoogleClient {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface GrantResult {
    refreshToken: string;
    email: string;
}

export interface MessageHeader {
    name: string;
    value: string;
}

interface MessagePage {
    ids: string[];
    next: string | null;
}

export interface GoogleApi {
    authUrl(options: AuthUrlOptions): string;
    exchange(code: string, verifier: string): Promise<GrantResult>;
    messagePage(refreshToken: string, query: string, pageToken: string | null): Promise<MessagePage>;
    messageHeaders(refreshToken: string, id: string): Promise<MessageHeader[]>;
    revoke(refreshToken: string): Promise<void>;
}

export type GoogleFactory = (client: GoogleClient) => GoogleApi;

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const PAGE_SIZE = 500;

/** Talks to Google for one OAuth client: building the consent link and turning a sign-in code into lasting access. */
export function googleApi(client: GoogleClient): GoogleApi {
    const oauth = new OAuth2Client({ clientId: client.clientId, clientSecret: client.clientSecret, redirectUri: client.redirectUri });
    return {
        authUrl: (options) => oauth.generateAuthUrl({ ...options, code_challenge_method: CodeChallengeMethod.S256 }),
        exchange: (code, verifier) => guarded(() => exchangeCode(oauth, { code, verifier, redirectUri: client.redirectUri })),
        messagePage: (token, query, pageToken) => guarded(() => listPage(authorized(oauth, token), { query, pageToken })),
        messageHeaders: (token, id) => guarded(() => headersOf(authorized(oauth, token), id)),
        revoke: (token) => guarded(async () => void (await oauth.revokeToken(token))),
    };
}

/** Swaps a sign-in code for tokens and looks up which Gmail address granted them. */
async function exchangeCode(oauth: OAuth2Client, input: { code: string; verifier: string; redirectUri: string }): Promise<GrantResult> {
    const { tokens } = await oauth.getToken({ code: input.code, codeVerifier: input.verifier, redirect_uri: input.redirectUri });
    if (!tokens.refresh_token) throw new GoogleError("unknown");
    oauth.setCredentials(tokens);
    const profile = await oauth.request<{ emailAddress?: string }>({ url: `${GMAIL}/profile` });
    if (!profile.data.emailAddress) throw new GoogleError("unknown");
    return { refreshToken: tokens.refresh_token, email: profile.data.emailAddress };
}

/** Points the OAuth client at the stored refresh token, so its requests carry fresh access. */
function authorized(oauth: OAuth2Client, refreshToken: string): OAuth2Client {
    oauth.setCredentials({ refresh_token: refreshToken });
    return oauth;
}

/** Fetches one page of message ids matching a Gmail search. */
async function listPage(oauth: OAuth2Client, search: { query: string; pageToken: string | null }): Promise<MessagePage> {
    const params = { q: search.query, maxResults: PAGE_SIZE, ...(search.pageToken === null ? {} : { pageToken: search.pageToken }) };
    const { data } = await oauth.request<{ messages?: Array<{ id: string }>; nextPageToken?: string }>({ url: `${GMAIL}/messages`, params });
    return { ids: (data.messages ?? []).map((message) => message.id), next: data.nextPageToken ?? null };
}

/** Fetches only the From, Subject and Date headers of one message. */
async function headersOf(oauth: OAuth2Client, id: string): Promise<MessageHeader[]> {
    const params = { format: "metadata", metadataHeaders: ["From", "Subject", "Date"] };
    const { data } = await oauth.request<{ payload?: { headers?: MessageHeader[] } }>({ url: `${GMAIL}/messages/${encodeURIComponent(id)}`, params });
    return data.payload?.headers ?? [];
}
