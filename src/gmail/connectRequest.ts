import { createHash, randomBytes } from "node:crypto";
import type { ConnectRequest } from "../db/store.js";

export interface NewConnectRequest {
    state: string;
    verifier: string;
    challenge: string;
}

export interface AuthUrlOptions {
    access_type: "offline";
    prompt: "consent";
    scope: string[];
    state: string;
    code_challenge: string;
    code_challenge_method: "S256";
}

const LOOPBACK = /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/i;
const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
export const REQUEST_LIFETIME_MS = 10 * 60 * 1000;

/** Tells whether Settings was opened on this machine's own address, the only kind Google will send the owner back to. */
export function isLoopbackHost(host: string): boolean {
    return LOOPBACK.test(host);
}

/** Creates the single-use state and PKCE verifier that tie Google's return to this sign-in. */
export function newConnectRequest(): NewConnectRequest {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { state: randomBytes(32).toString("base64url"), verifier, challenge };
}

/** Returns where Google sends the owner after signing in: the callback on the address Settings was opened with. */
export function redirectUri(host: string): string {
    return `http://${host}/settings/gmail/callback`;
}

/** Tells whether a taken sign-in request exists and was started within the last 10 minutes. */
export function isFresh(request: ConnectRequest | null, now: Date): boolean {
    return request !== null && now.getTime() - Date.parse(request.createdAt) <= REQUEST_LIFETIME_MS;
}

/** Returns the options for Google's consent screen: offline, read-only Gmail access, protected by PKCE. */
export function authUrlOptions(request: { state: string; challenge: string }): AuthUrlOptions {
    return { access_type: "offline", prompt: "consent", scope: [GMAIL_READONLY], state: request.state, code_challenge: request.challenge, code_challenge_method: "S256" };
}
