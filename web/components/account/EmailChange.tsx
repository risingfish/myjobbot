"use client";

import { useState } from "react";
import { requestEmailChange } from "../../lib/accountActions.js";
import { shownRefusal, useStepUp } from "./StepUp.js";

/** Renders the email the account signs in with and the form that mails a confirmation link to a new one; nothing changes until it is opened. */
export function EmailChange({ email }: { email: string }) {
    const run = useStepUp();
    const [answer, setAnswer] = useState<{ ok: boolean; message?: string; stepUp?: true } | null>(null);
    const change = async (form: FormData) => setAnswer(await run(() => requestEmailChange(String(form.get("new-email") ?? ""))));
    const refusal = answer === null ? null : shownRefusal(answer);
    return (
        <form action={change}>
            <p>
                Email: <strong>{email}</strong>
            </p>
            <label htmlFor="new-email">New email</label>
            <fieldset role="group">
                <input id="new-email" name="new-email" type="email" autoComplete="email" required aria-invalid={refusal !== null || undefined} />
                <button type="submit">Change email</button>
            </fieldset>
            {refusal !== null && <small role="alert">{refusal}</small>}
            {answer?.ok && <small role="status">{answer.message}</small>}
        </form>
    );
}
