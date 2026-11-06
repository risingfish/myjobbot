"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import * as changes from "../../src/accounts/flows/accountChanges.js";
import type { Actor } from "../../src/accounts/flows/context.js";
import { confirmIdentity as confirm } from "../../src/accounts/flows/confirmIdentity.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { METHOD_KINDS, type MethodKind } from "../../src/db/methodStore.js";
import { authContext, webSettings, type WebSettings } from "./authDeps.js";
import { guarded } from "./guard.js";
import { requestAddress, setSessionCookies } from "./requestAuth.js";
import { requireSession } from "./session.js";

export type AccountAnswer = { ok: true; setup?: MethodKind } | { ok: false; message: string; stepUp?: true };

const SIGNED_OUT: AccountAnswer = { ok: false, message: MESSAGES.signed_out };
const text = z.string().max(1000);
const methodChange = z.object({ kind: z.enum(METHOD_KINDS), enabled: z.boolean() });

/** Returns the signed-in account as the account flows act for it, with this request's settings. */
async function actorNow(): Promise<{ actor: Actor; settings: WebSettings } | null> {
    const settings = webSettings();
    if (settings === null) return null;
    const { account, session } = await requireSession();
    return { actor: { account, session, address: await requestAddress(settings) }, settings };
}

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
    const answer = await changes.changePassword(await authContext(), now.actor, parsed.data);
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

/** Proves the signed-in account's identity again with its password, so sensitive changes go through for the next 10 minutes. */
async function confirmIdentityAction(password: unknown): Promise<AccountAnswer> {
    const parsed = text.safeParse(password);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    return confirm(await authContext(), now.actor, { method: "password", password: parsed.data });
}

export const saveName = guarded(saveNameAction, {});
export const changePassword = guarded(changePasswordAction, { stepUp: true });
export const setMethodEnabled = guarded(setMethodEnabledAction, { stepUp: true });
export const signOutEverywhereElse = guarded(signOutEverywhereElseAction, { stepUp: true });
export const signOutDevice = guarded(signOutDeviceAction, {});
export const confirmIdentity = guarded(confirmIdentityAction, {});
