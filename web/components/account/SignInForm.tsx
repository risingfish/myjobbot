"use client";

import { useActionState } from "react";
import { signInWithPasswordForm, type SignInState } from "../../lib/signInActions.js";
import { Field } from "./Field.js";

const READY: SignInState = { message: null };

/** Renders the sign-in form; a refusal marks both fields and shows its one fixed message under the password. */
export function SignInForm({ next }: { next: string }) {
    const [state, signIn, signingIn] = useActionState(signInWithPasswordForm, READY);
    const refused = state.message !== null;
    return (
        <form action={signIn}>
            <input type="hidden" name="next" value={next} />
            <Field name="email" label="Email" type="email" autoComplete="username" required invalid={refused} />
            <Field name="password" label="Password" type="password" autoComplete="current-password" required invalid={refused} note={state.message} />
            <button type="submit" aria-busy={signingIn} disabled={signingIn}>
                Sign in
            </button>
        </form>
    );
}
