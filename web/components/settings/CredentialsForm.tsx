"use client";

import { useActionState } from "react";
import type { SaveResult } from "../../../src/gmail/connection.js";
import { saveGmailCredentials } from "../../lib/gmailActions.js";

const READY: SaveResult = { ok: true, error: null };

/** Renders the client ID and secret fields that save the owner's Google OAuth client, with the reason a save was refused. */
export function CredentialsForm() {
    const [result, save, saving] = useActionState(saveGmailCredentials, READY);
    return (
        <form action={save} className="credentials">
            <label>
                Client ID <input name="client_id" autoComplete="off" />
            </label>
            <label>
                Client secret <input name="client_secret" type="password" autoComplete="off" />
            </label>
            <button disabled={saving}>Save</button>
            {result.error && (
                <p role="alert" className="note">
                    {result.error}
                </p>
            )}
        </form>
    );
}
