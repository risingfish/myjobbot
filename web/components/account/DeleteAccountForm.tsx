"use client";

import { deletionDate } from "../../../src/accounts/accountLifecycle.js";
import { utcMinutes } from "../../../src/time/minutes.js";
import { requestAccountDeletion } from "../../lib/accountStatusActions.js";

type Change = (action: () => Promise<{ ok: boolean; message?: string; stepUp?: true }>) => Promise<void>;

/** Renders what deleting removes and when, and asks for the account's email before asking for the deletion. */
export function DeleteAccountForm({ change }: { change: Change }) {
    const submit = async (form: FormData) => change(() => requestAccountDeletion(String(form.get("email") ?? "")));
    return (
        <form action={submit} className="delete-account">
            <p>Deleting removes your jobs and their scores, your history and re-score logs, your sources, settings, resume and profile, your Gmail connection and your ways of signing in, on {utcMinutes(deletionDate(new Date().toISOString()))}. Until then you can sign in and cancel. Shared postings stay.</p>
            <label htmlFor="delete-email">Your account&apos;s email</label>
            <fieldset role="group">
                <input id="delete-email" name="email" type="email" autoComplete="email" required />
                <button type="submit">Delete my account</button>
            </fieldset>
        </form>
    );
}
