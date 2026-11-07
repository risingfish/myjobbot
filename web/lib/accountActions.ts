"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import * as changes from "../../src/accounts/flows/accountChanges.js";
import { confirmIdentity as confirm } from "../../src/accounts/flows/confirmIdentity.js";
import * as links from "../../src/accounts/flows/emailLinks.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { CARD_KINDS } from "../../src/accounts/ways/catalog.js";
import { changePassword as changePasswordFor } from "../../src/accounts/ways/password.js";
import type { MethodKind } from "../../src/db/methodStore.js";
import { actorNow } from "./actor.js";
import { authContext } from "./authDeps.js";
import { guarded } from "./guard.js";
import { setSessionCookies } from "./requestAuth.js";

export type AccountAnswer = { ok: true; setup?: MethodKind; message?: string } | { ok: false; message: string; stepUp?: true };

const SIGNED_OUT: AccountAnswer = { ok: false, message: MESSAGES.signed_out };
const text = z.string().max(1000);
const methodChange = z.object({ kind: z.enum(CARD_KINDS), enabled: z.boolean() });

/** Saves the signed-in account's new name, shown again in the header. */
async function saveNameAction(name: unknown): Promise<AccountAnswer> {
    const parsed = text.safeParse(name);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    const answer = await changes.saveName(await authContext(), now.actor, parsed.data);
    if (answer.ok) revalidatePath("/", "layout");
    return answer;
}

/** Changes the password given the current one, keeping this browser signed in on a new sign-in. */
async function changePasswordAction(current: unknown, next: unknown): Promise<AccountAnswer> {
    const parsed = z.object({ current: text, next: text }).safeParse({ current, next });
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    const answer = await changePasswordFor(await authContext(), now.actor, parsed.data);
    if (!answer.ok) return answer;
    await setSessionCookies(now.settings, answer.cookies);
    revalidatePath("/account");
    return { ok: true };
}

/** Switches one way of signing in on or off. */
async function setMethodEnabledAction(kind: unknown, enabled: unknown): Promise<AccountAnswer> {
    const parsed = methodChange.safeParse({ kind, enabled });
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    const answer = await changes.setMethodEnabled(await authContext(), now.actor, parsed.data);
    revalidatePath("/account");
    return answer;
}

/** Ends every sign-in of the account but this browser's. */
async function signOutEverywhereElseAction(): Promise<AccountAnswer> {
    const now = await actorNow();
    if (now === null) return SIGNED_OUT;
    await changes.signOutEverywhereElse(await authContext(), now.actor);
    revalidatePath("/account");
    return { ok: true };
}

/** Signs one of the account's other devices out. */
async function signOutDeviceAction(ref: unknown): Promise<AccountAnswer> {
    const parsed = z.string().regex(/^[0-9a-f]{16}$/).safeParse(ref);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    const answer = await changes.signOutDevice(await authContext(), now.actor, parsed.data);
    revalidatePath("/account");
    return answer;
}

/** Mails the test email to the signed-in account. */
async function sendTestEmailAction(): Promise<AccountAnswer> {
    const now = await actorNow();
    return now === null ? SIGNED_OUT : links.sendTestEmail(await authContext(), now.actor);
}

/** Mails a link confirming a new email to that address; nothing changes until it is opened. */
async function requestEmailChangeAction(email: unknown): Promise<AccountAnswer> {
    const parsed = text.safeParse(email);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    return links.requestEmailChange(await authContext(), now.actor, parsed.data);
}

/** Mails a confirm-it's-you link for this browser, returning afterwards to the page it was asked from. */
async function requestStepUpLinkAction(returnPath: unknown): Promise<AccountAnswer> {
    const parsed = text.safeParse(returnPath);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    return links.requestStepUpLink(await authContext(), now.actor, parsed.data);
}

const proof = z.discriminatedUnion("method", [z.object({ method: z.literal("password"), password: text }), z.object({ method: z.literal("authenticator"), code: text }), z.object({ method: z.literal("recovery_code"), code: text }), z.object({ method: z.literal("hardware_key"), response: z.unknown() })]);

/** Proves the signed-in account's identity again by its password, an app code, a recovery code or a key, so sensitive changes go through for the next 10 minutes. */
async function confirmIdentityAction(method: unknown, value: unknown): Promise<AccountAnswer> {
    const parsed = proof.safeParse(method === "password" ? { method, password: value } : method === "hardware_key" ? { method, response: value } : { method, code: value });
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    return confirm(await authContext(), now.actor, parsed.data);
}

export const saveName = guarded(saveNameAction, {});
export const changePassword = guarded(changePasswordAction, { stepUp: true });
export const setMethodEnabled = guarded(setMethodEnabledAction, { stepUp: true });
export const signOutEverywhereElse = guarded(signOutEverywhereElseAction, { stepUp: true });
export const signOutDevice = guarded(signOutDeviceAction, {});
export const confirmIdentity = guarded(confirmIdentityAction, {});
export const sendTestEmail = guarded(sendTestEmailAction, {});
export const requestEmailChange = guarded(requestEmailChangeAction, { stepUp: true });
export const requestStepUpLink = guarded(requestStepUpLinkAction, {});
