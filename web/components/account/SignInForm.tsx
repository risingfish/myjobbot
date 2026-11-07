"use client";

import { useActionState, useState } from "react";
import { MESSAGES } from "../../../src/accounts/messages.js";
import { signInWithKey } from "../../lib/keyBrowser.js";
import { withPosition } from "../../lib/position.js";
import { requestPasswordResetForm, requestSignInLinkForm, signInForm, type SignInState } from "../../lib/signInActions.js";
import { Field } from "./Field.js";
import { WayChoice, type Way } from "./WayChoice.js";

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

/** Renders the sign-in form: the email and the chosen way's field; a refusal marks both and shows its one fixed message under the second. */
export function SignInForm({ next }: { next: string }) {
    const [state, signIn, signingIn] = useActionState(async (previous: SignInState, form: FormData) => (form.get("way") === "hardware_key" ? signInWithKey(await withPosition(form)) : signInForm(previous, await withPosition(form))), READY);
    const [way, setWay] = useState<Way>("password");
    const [linkState, requestLink] = useActionState(requestSignInLinkForm, READY);
    const [resetState, requestReset] = useActionState(requestPasswordResetForm, READY);
    const linkNote = linkState.message ?? resetState.message;
    const badEmail = linkNote === MESSAGES.email_invalid;
    const refused = state.message !== null;
    return (
        <form action={signIn}>
            <input type="hidden" name="next" value={next} />
            <Field name="email" label="Email" type="email" autoComplete="username" required invalid={refused || badEmail} note={badEmail ? linkNote : null} />
            <WayChoice way={way} onWay={setWay} refusal={state.message} />
            <button type="submit" aria-busy={signingIn} disabled={signingIn}>
                Sign in
            </button>
            <LinkButtons note={linkNote} requestLink={requestLink} requestReset={requestReset} />
        </form>
    );
}
