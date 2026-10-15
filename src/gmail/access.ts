import type { GmailDeps } from "./connection.js";
import { redirectUri } from "./connectRequest.js";
import { googleApi, type GoogleApi } from "./google.js";
import { openSealed, SealError, type SealedField } from "./seal.js";

/** Opens a sealed value, or returns null when the key can no longer open it. */
export function openOrNull(sealed: string, field: SealedField, key: Buffer): string | null {
    try {
        return openSealed(sealed, field, key);
    } catch (error) {
        if (error instanceof SealError) return null;
        throw error;
    }
}

/** Builds the Google client for the saved OAuth client, or says why it can't: nothing saved, or the key changed. */
export async function clientFor(deps: GmailDeps, host: string): Promise<GoogleApi | "no_credentials" | "key_changed"> {
    const row = await deps.gmail.connection();
    if (!row?.client_id || !row.client_secret) return "no_credentials";
    const clientSecret = openOrNull(row.client_secret, "client_secret", deps.key);
    if (clientSecret === null) return "key_changed";
    return (deps.google ?? googleApi)({ clientId: row.client_id, clientSecret, redirectUri: redirectUri(host) });
}
