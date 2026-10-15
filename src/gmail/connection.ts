import type { GmailConnectionRow, GmailStore } from "../db/store.js";
import { openSealed, seal, SealError } from "./seal.js";

export interface GmailDeps {
    gmail: GmailStore;
    key: Buffer;
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
    await deps.gmail.saveCredentials(clientId, seal(clientSecret, "client_secret", deps.key), now.toISOString());
    return { ok: true, error: null };
}

/** Forgets the owner's Google OAuth client and any connection made with it. */
export async function clearCredentials(deps: GmailDeps): Promise<void> {
    await deps.gmail.clearCredentials();
}

/** Tells whether the saved client secret no longer opens, which means the server key was changed. */
export function keyChanged(deps: GmailDeps, row: GmailConnectionRow | null): boolean {
    if (!row?.client_secret) return false;
    try {
        openSealed(row.client_secret, "client_secret", deps.key);
        return false;
    } catch (error) {
        if (error instanceof SealError) return true;
        throw error;
    }
}

/** Explains why a credential field can't be saved, or returns null when its length is fine. */
function lengthError(label: string, value: string): string | null {
    return value.length >= 1 && value.length <= MAX_LENGTH ? null : `The ${label} must be 1–${MAX_LENGTH} characters.`;
}
