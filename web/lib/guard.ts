import { headers } from "next/headers.js";
import { redirect } from "next/navigation.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { signInFromReferer } from "../../src/web/signedOut.js";
import { webSettings } from "./authDeps.js";
import { currentSession } from "./session.js";

export interface GuardOptions {
    public?: boolean;
    admin?: boolean;
}

export interface Refusal {
    ok: false;
    message: string;
}

type Action<A extends unknown[], R> = (...args: A) => Promise<R>;

/** Sends a signed-out browser to the sign-in page, returning to the page the action came from. */
async function toSignIn(): Promise<never> {
    const origin = webSettings()?.url.origin ?? "";
    redirect(signInFromReferer((await headers()).get("referer"), origin));
}

/** Checks the sign-in and the admin mark an action needs, giving a refusal for a missing mark, before the action runs. */
async function refusalFor(options: GuardOptions): Promise<Refusal | null> {
    if (options.public) return null;
    const signedIn = await currentSession();
    if (signedIn === null) return toSignIn();
    return options.admin && !signedIn.account.isAdmin ? { ok: false, message: MESSAGES.not_admin } : null;
}

/** Wraps a server action so it runs only with the sign-in, and the admin mark, it needs; a signed-out browser is sent to sign in first. */
export function guarded<A extends unknown[], R>(action: Action<A, R>, options: { public?: boolean }): Action<A, R>;
export function guarded<A extends unknown[], R>(action: Action<A, R>, options: { admin: true }): Action<A, R | Refusal>;
export function guarded<A extends unknown[], R>(action: Action<A, R>, options: GuardOptions): Action<A, R | Refusal> {
    return async (...args: A): Promise<R | Refusal> => (await refusalFor(options)) ?? action(...args);
}
