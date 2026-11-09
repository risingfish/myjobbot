"use server";

import { cookies } from "next/headers.js";
import { redirect } from "next/navigation.js";
import { createAccount } from "../../src/accounts/flows/createAccount.js";
import { requestPasswordReset, spendEmailLink } from "../../src/accounts/flows/emailLinks.js";
import { signInByWay, signOut } from "../../src/accounts/flows/signIn.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { safeReturnPath } from "../../src/accounts/returnPath.js";
import { CHOICE_KINDS, choiceOf, type ChoiceKind } from "../../src/accounts/ways/catalog.js";
import { requestSignInLink } from "../../src/accounts/ways/emailLink.js";
import { refusedField, type AccountField } from "../../src/web/accountForms.js";
import { parseLinkFragment } from "../../src/web/linkFragment.js";
import { authContext } from "./authDeps.js";
import { webSettings } from "./webSettings.js";
import { guarded } from "./guard.js";
import { heldDigest, requestAddress, requestDevice, setSessionCookies } from "./requestAuth.js";

export interface SignInState {
    message: string | null;
}

export interface CreateAccountState {
    message: string | null;
    field: AccountField | null;
    email: string;
    name: string;
}

/** Reads one text field from a submitted form. */
function field(form: FormData, name: string): string {
    return String(form.get(name) ?? "");
}

/** Reads the way the form chose, among those typed into a field; anything else is taken as the password. */
function typedWay(form: FormData): ChoiceKind {
    const way = CHOICE_KINDS.find((kind) => kind === field(form, "way"));
    return way !== undefined && choiceOf(way).field.kind === "text" ? way : "password";
}

/** Signs in with the email and the way chosen on the sign-in form, then goes to the page asked for; every failure answers the same. */
async function signInAction(_previous: SignInState, form: FormData): Promise<SignInState> {
    const settings = webSettings();
    if (settings === null) return { message: MESSAGES.signin_failed };
    const request = { email: field(form, "email"), address: await requestAddress(settings), heldDigest: await heldDigest(settings), device: await requestDevice(settings, form) };
    const answer = await signInByWay(await authContext(), request, { kind: typedWay(form), fields: { password: field(form, "password"), code: field(form, "code") } });
    if (!answer.ok) return { message: answer.message };
    await setSessionCookies(settings, answer.cookies);
    redirect(safeReturnPath(field(form, "next")));
}

/** Makes an account from the public form with an admin's code, signs it in and goes to the Account page; a refusal keeps the email and name typed. */
async function createAccountAction(_previous: CreateAccountState, form: FormData): Promise<CreateAccountState> {
    const typed = { email: field(form, "email"), name: field(form, "name") };
    const settings = webSettings();
    if (settings === null) return { message: MESSAGES.code_refused, field: "code", ...typed };
    const input = { ...typed, password: field(form, "password"), code: field(form, "code").trim(), address: await requestAddress(settings), heldDigest: await heldDigest(settings), device: await requestDevice(settings, form) };
    const answer = await createAccount(await authContext(), input);
    if (!answer.ok) return { message: answer.message, field: refusedField(answer.message), ...typed };
    await setSessionCookies(settings, answer.cookies);
    redirect("/account");
}

export type LinkAnswer = { ok: true; kind: "signin" | "reset" | "email_change" | "step_up"; next: string } | { ok: false; message: string };

/** Mails a link through the flow given, a sign-in link or a password reset link, for the email typed on the sign-in form; every email gets the same answer. */
async function requestLinkAction(form: FormData, request: typeof requestSignInLink): Promise<SignInState> {
    const settings = webSettings();
    if (settings === null) return { message: MESSAGES.mail_off };
    const answer = await request(await authContext(), { email: field(form, "email"), address: await requestAddress(settings) });
    return { message: answer.message ?? null };
}

/** Mails a sign-in link for the email on the sign-in form. */
async function requestSignInLinkAction(_previous: SignInState, form: FormData): Promise<SignInState> {
    return requestLinkAction(form, requestSignInLink);
}

/** Mails a password reset link for the email on the sign-in form. */
async function requestPasswordResetAction(_previous: SignInState, form: FormData): Promise<SignInState> {
    return requestLinkAction(form, requestPasswordReset);
}

/** Uses an emailed link the browser read from its address's fragment, signing this browser in for a sign-in link. */
async function spendEmailLinkAction(hash: unknown, password: unknown): Promise<LinkAnswer> {
    const link = parseLinkFragment(typeof hash === "string" ? hash : "");
    const settings = webSettings();
    if (link === null || settings === null) return { ok: false, message: MESSAGES.link_expired };
    const held = await heldDigest(settings);
    const spend = { ...link, password: typeof password === "string" ? password : undefined, sessionDigest: held, address: await requestAddress(settings), heldDigest: held, device: await requestDevice(settings, new FormData()) };
    const answer = await spendEmailLink(await authContext(), spend);
    if (!answer.ok) return answer;
    if ("cookies" in answer) await setSessionCookies(settings, answer.cookies);
    return { ok: true, kind: answer.kind, next: "next" in answer ? answer.next : "/" };
}

/** Ends this browser's sign-in on the server, forgets its cookies and goes to the sign-in page. */
async function signOutAction(): Promise<void> {
    const settings = webSettings();
    const held = settings === null ? null : await heldDigest(settings);
    if (held !== null) await signOut(await authContext(), held);
    if (settings !== null) (await cookies()).delete(settings.cookies.session.name);
    redirect("/sign-in");
}

export const signInForm = guarded(signInAction, { public: true });
export const createAccountForm = guarded(createAccountAction, { public: true });
export const signOutNow = guarded(signOutAction, {});
export const requestSignInLinkForm = guarded(requestSignInLinkAction, { public: true });
export const requestPasswordResetForm = guarded(requestPasswordResetAction, { public: true });
export const spendEmailLinkNow = guarded(spendEmailLinkAction, { public: true });
