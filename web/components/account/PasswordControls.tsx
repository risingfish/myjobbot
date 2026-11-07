"use client";

import { useState } from "react";
import { MESSAGES } from "../../../src/accounts/messages.js";
import { changePassword } from "../../lib/accountActions.js";
import { Field } from "./Field.js";
import { shownRefusal, useStepUp } from "./StepUp.js";

/** Renders the password change form: the current password, a new one meeting the rule, and each refusal under its field. */
export function PasswordControls() {
    const run = useStepUp();
    const [answer, setAnswer] = useState<{ ok: boolean; message?: string } | null>(null);
    const change = async (form: FormData) => setAnswer(await run(() => changePassword(String(form.get("current") ?? ""), String(form.get("next") ?? ""))));
    const refusal = answer === null ? null : shownRefusal(answer);
    const onCurrent = refusal === MESSAGES.current_password;
    return (
        <form action={change}>
            <Field name="current" label="Current password" type="password" autoComplete="current-password" required invalid={onCurrent} note={onCurrent ? refusal : null} />
            <Field name="next" label="New password" type="password" autoComplete="new-password" required invalid={refusal !== null && !onCurrent} note={refusal !== null && !onCurrent ? refusal : MESSAGES.password_rule} />
            <button type="submit">Change password</button>
            {answer?.ok && <p role="status">Password changed. Every other sign-in has ended.</p>}
        </form>
    );
}
