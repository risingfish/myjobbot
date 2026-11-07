"use client";

import { useActionState } from "react";
import { MESSAGES } from "../../../src/accounts/messages.js";
import { withPosition } from "../../lib/position.js";
import { requestPasswordResetForm, requestSignInLinkForm, signInWithPasswordForm, type SignInState } from "../../lib/signInActions.js";
import { Field } from "./Field.js";

const READY: SignInState = { message: null };

/** Renders the buttons that mail a sign-in link or a password reset for the email typed, and what the last request answered. */
function LinkButtons({ note, requestLink, requestReset }: { note: string | null; requestLink: (form: FormData) => void; requestReset: (form: FormData) => void }) {
    return (
        <>
            <div role="group">
                <button type="submit" className="secondary outline" formAction={requestLink} formNoValidate>
                    Email me a link
                </button>
                <button type="submit" className="secondary outline" formAction={requestReset} formNoValidate>
                    Forgot password
                </button>
            </div>
            {note !== null && note !== MESSAGES.email_invalid && <p role="status">{note}</p>}
        </>
    );
}

/** Renders the sign-in form; a refusal marks both fields and shows its one fixed message under the password. */
export function SignInForm({ next }: { next: string }) {
    const [state, signIn, signingIn] = useActionState(async (previous: SignInState, form: FormData) => signInWithPasswordForm(previous, await withPosition(form)), READY);
    const [linkState, requestLink] = useActionState(requestSignInLinkForm, READY);
    const [resetState, requestReset] = useActionState(requestPasswordResetForm, READY);
    const linkNote = linkState.message ?? resetState.message;
    const badEmail = linkNote === MESSAGES.email_invalid;
    const refused = state.message !== null;
    return (
        <form action={signIn}>
            <input type="hidden" name="next" value={next} />
            <Field name="email" label="Email" type="email" autoComplete="username" required invalid={refused || badEmail} note={badEmail ? linkNote : null} />
            <Field name="password" label="Password" type="password" autoComplete="current-password" required invalid={refused} note={state.message} />
            <button type="submit" aria-busy={signingIn} disabled={signingIn}>
                Sign in
            </button>
            <LinkButtons note={linkNote} requestLink={requestLink} requestReset={requestReset} />
        </form>
    );
}
