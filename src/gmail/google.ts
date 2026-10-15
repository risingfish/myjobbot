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

export interface GoogleApi {
    authUrl(options: AuthUrlOptions): string;
    exchange(code: string, verifier: string): Promise<GrantResult>;
}

export type GoogleFactory = (client: GoogleClient) => GoogleApi;

const PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

/** Talks to Google for one OAuth client: building the consent link and turning a sign-in code into lasting access. */
export function googleApi(client: GoogleClient): GoogleApi {
    const oauth = new OAuth2Client({ clientId: client.clientId, clientSecret: client.clientSecret, redirectUri: client.redirectUri });
    return {
        authUrl: (options) => oauth.generateAuthUrl({ ...options, code_challenge_method: CodeChallengeMethod.S256 }),
        exchange: (code, verifier) => guarded(() => exchangeCode(oauth, { code, verifier, redirectUri: client.redirectUri })),
    };
}

/** Swaps a sign-in code for tokens and looks up which Gmail address granted them. */
async function exchangeCode(oauth: OAuth2Client, input: { code: string; verifier: string; redirectUri: string }): Promise<GrantResult> {
    const { tokens } = await oauth.getToken({ code: input.code, codeVerifier: input.verifier, redirect_uri: input.redirectUri });
    if (!tokens.refresh_token) throw new GoogleError("unknown");
    oauth.setCredentials(tokens);
    const profile = await oauth.request<{ emailAddress?: string }>({ url: PROFILE_URL });
    if (!profile.data.emailAddress) throw new GoogleError("unknown");
    return { refreshToken: tokens.refresh_token, email: profile.data.emailAddress };
}
