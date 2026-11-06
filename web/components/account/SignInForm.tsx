"use client";

import { useActionState } from "react";
import { signInWithPasswordForm, type SignInState } from "../../lib/signInActions.js";

const READY: SignInState = { message: null };

/** Renders the email and password fields, both marked when a sign-in was refused. */
function SignInFields({ refused }: { refused: boolean }) {
    return (
        <>
            <label>
                Email
                <input name="email" type="email" autoComplete="username" required aria-invalid={refused || undefined} />
            </label>
            <label>
                Password
                <input name="password" type="password" autoComplete="current-password" required aria-invalid={refused || undefined} />
            </label>
        </>
    );
}

/** Renders the sign-in form, with the one fixed answer a refused sign-in gets. */
export function SignInForm({ next }: { next: string }) {
    const [state, signIn, signingIn] = useActionState(signInWithPasswordForm, READY);
    return (
        <form action={signIn}>
            <input type="hidden" name="next" value={next} />
            <SignInFields refused={state.message !== null} />
            {state.message !== null && <small role="alert">{state.message}</small>}
            <button type="submit" aria-busy={signingIn} disabled={signingIn}>
                Sign in
            </button>
        </form>
    );
}
