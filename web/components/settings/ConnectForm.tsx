"use client";

import { useActionState } from "react";
import type { ConnectResult } from "../../../src/gmail/connection.js";
import { connectGmail } from "../../lib/gmailActions.js";

const READY: ConnectResult = { ok: true, error: null };

/** Renders the Gmail address and app password fields that connect Gmail, with the reason a connect was refused. */
export function ConnectForm() {
    const [result, connect, connecting] = useActionState(connectGmail, READY);
    return (
        <form action={connect} className="credentials">
            <label>
                Gmail address <input name="email" type="email" autoComplete="off" />
            </label>
            <label>
                App password <input name="app_password" type="password" autoComplete="off" />
            </label>
            <button disabled={connecting}>Connect</button>
            {result.error && (
                <p role="alert" className="note">
                    {result.error}
                </p>
            )}
        </form>
    );
}
