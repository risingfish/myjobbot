"use server";

import { cookies, headers } from "next/headers.js";
import { redirect } from "next/navigation.js";
import { signInWithPassword, signOut } from "../../src/accounts/flows/signIn.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { safeReturnPath } from "../../src/accounts/returnPath.js";
import { tokenDigest } from "../../src/accounts/tokens.js";
import { clientAddress } from "../../src/web/security/clientAddress.js";
import { authContext, webSettings, type WebSettings } from "./authDeps.js";
import { guarded } from "./guard.js";

export interface SignInState {
    message: string | null;
}

/** Returns the digest of the sign-in cookie the browser holds, or null. */
async function heldDigest(settings: WebSettings): Promise<string | null> {
    const value = (await cookies()).get(settings.cookies.session.name)?.value;
    return value === undefined ? null : tokenDigest(value);
}

/** Signs in with the email and password from the sign-in form, then goes to the page asked for; every failure answers the same. */
async function signInWithPasswordAction(_previous: SignInState, form: FormData): Promise<SignInState> {
    const settings = webSettings();
    if (settings === null) return { message: MESSAGES.signin_failed };
    const address = clientAddress((await headers()).get("x-forwarded-for"), settings.trustedProxies);
    const input = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), address, heldDigest: await heldDigest(settings) };
    const answer = await signInWithPassword(await authContext(), input);
    if (!answer.ok) return { message: answer.message };
    const jar = await cookies();
    jar.set(settings.cookies.session.name, answer.cookies.session, settings.cookies.session.options);
    jar.set(settings.cookies.csrf.name, answer.cookies.csrf, settings.cookies.csrf.options);
    redirect(safeReturnPath(String(form.get("next") ?? "")));
}

/** Ends this browser's sign-in on the server, forgets its cookies and goes to the sign-in page. */
async function signOutAction(): Promise<void> {
    const settings = webSettings();
    const held = settings === null ? null : await heldDigest(settings);
    if (held !== null) await signOut(await authContext(), held);
    if (settings !== null) (await cookies()).delete(settings.cookies.session.name);
    redirect("/sign-in");
}

export const signInWithPasswordForm = guarded(signInWithPasswordAction, { public: true });
export const signOutNow = guarded(signOutAction, {});
