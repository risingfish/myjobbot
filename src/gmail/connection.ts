import type { GmailConnectionRow, GmailStore } from "../db/store.js";
import { clientFor, openOrNull } from "./access.js";
import { authUrlOptions, isFresh, newConnectRequest, REQUEST_LIFETIME_MS } from "./connectRequest.js";
import type { GoogleFactory } from "./google.js";
import { GoogleError } from "./googleErrors.js";
import { seal } from "./seal.js";

export interface GmailDeps {
    gmail: GmailStore;
    key: Buffer;
    google?: GoogleFactory;
}

export type ConnectOutcome = "connected" | "denied" | "refused" | "bad_client" | "key_changed" | "failed";
export type StartResult = { ok: true; url: string } | { ok: false; reason: "no_credentials" | "key_changed" };

export interface Callback {
    state: string | null;
    code: string | null;
    error: string | null;
    host: string;
}

export interface Credentials {
    clientId: string;
    clientSecret: string;
}

export interface SaveResult {
    ok: boolean;
    error: string | null;
}

const MAX_LENGTH = 255;

/** Saves the owner's Google OAuth client, sealing the secret before it reaches the database. */
export async function saveCredentials(deps: GmailDeps, input: Credentials, now: Date): Promise<SaveResult> {
    const clientId = input.clientId.trim();
    const clientSecret = input.clientSecret.trim();
    const error = lengthError("client ID", clientId) ?? lengthError("client secret", clientSecret);
    if (error !== null) return { ok: false, error };
    await disconnectIfStored(deps);
    await deps.gmail.saveCredentials(clientId, seal(clientSecret, "client_secret", deps.key), now.toISOString());
    return { ok: true, error: null };
}

/** Forgets the owner's Google OAuth client and any connection made with it. */
export async function clearCredentials(deps: GmailDeps): Promise<void> {
    await disconnectIfStored(deps);
    await deps.gmail.clearCredentials();
}

/** Disconnects Gmail: asks Google to revoke access, then forgets the token even if the revoke couldn't run. */
export async function disconnect(deps: GmailDeps): Promise<{ revoked: boolean }> {
    const sealed = (await deps.gmail.connection())?.refresh_token ?? null;
    const revoked = sealed === null ? true : await revoke(deps, sealed);
    await deps.gmail.disconnect();
    return { revoked };
}

/** Disconnects first whenever a token is stored, so replacing or clearing credentials leaves no grant behind. */
async function disconnectIfStored(deps: GmailDeps): Promise<void> {
    if ((await deps.gmail.connection())?.refresh_token) await disconnect(deps);
}

/** Asks Google to revoke a stored token, reporting false when the token won't open or Google can't be reached. */
async function revoke(deps: GmailDeps, sealed: string): Promise<boolean> {
    const token = openOrNull(sealed, "refresh_token", deps.key);
    const api = await clientFor(deps, "localhost");
    if (token === null || typeof api === "string") return false;
    return api.revoke(token).then(
        () => true,
        (error: unknown) => {
            if (error instanceof GoogleError) return false;
            throw error;
        },
    );
}

/** Tells whether the saved client secret no longer opens, which means the server key was changed. */
export function keyChanged(deps: GmailDeps, row: GmailConnectionRow | null): boolean {
    return Boolean(row?.client_secret) && openOrNull(row?.client_secret ?? "", "client_secret", deps.key) === null;
}

/** Explains why a credential field can't be saved, or returns null when its length is fine. */
function lengthError(label: string, value: string): string | null {
    return value.length >= 1 && value.length <= MAX_LENGTH ? null : `The ${label} must be 1–${MAX_LENGTH} characters.`;
}

/** Starts a Google sign-in: remembers a single-use request and returns the consent link to send the owner to. */
export async function startConnect(deps: GmailDeps, host: string, now: Date): Promise<StartResult> {
    const api = await clientFor(deps, host);
    if (typeof api === "string") return { ok: false, reason: api };
    const request = newConnectRequest();
    await deps.gmail.pruneConnectRequests(new Date(now.getTime() - REQUEST_LIFETIME_MS).toISOString());
    await deps.gmail.addConnectRequest(request.state, seal(request.verifier, "code_verifier", deps.key), now.toISOString());
    return { ok: true, url: api.authUrl(authUrlOptions(request)) };
}

/** Finishes a Google sign-in from the callback, storing lasting access only for a fresh request this panel started. */
export async function finishConnect(deps: GmailDeps, callback: Callback, now: Date): Promise<ConnectOutcome> {
    if (callback.error !== null) return "denied";
    const request = await deps.gmail.takeConnectRequest(callback.state ?? "");
    if (!isFresh(request, now) || request === null || callback.code === null) return "refused";
    const api = await clientFor(deps, callback.host);
    const verifier = openOrNull(request.sealedVerifier, "code_verifier", deps.key);
    if (typeof api === "string" || verifier === null) return api === "no_credentials" ? "refused" : "key_changed";
    try {
        const grant = await api.exchange(callback.code, verifier);
        await deps.gmail.connected({ sealedToken: seal(grant.refreshToken, "refresh_token", deps.key), email: grant.email }, now.toISOString());
        return "connected";
    } catch (error) {
        return failedOutcome(error);
    }
}

/** Names a failed token exchange: Google rejecting the OAuth client, or any other failure. */
function failedOutcome(error: unknown): ConnectOutcome {
    if (!(error instanceof GoogleError)) throw error;
    return error.code === "invalid_client" || error.code === "unauthorized_client" ? "bad_client" : "failed";
}
