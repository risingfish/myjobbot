"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import { makeAccountCode, setAdmin } from "../../src/accounts/flows/admin.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { authContext, webSettings } from "./authDeps.js";
import { guarded } from "./guard.js";
import { requestAddress, setSessionCookies } from "./requestAuth.js";
import { requireSession } from "./session.js";

export type CodeAnswer = { ok: true; code: string; expiresAt: string } | { ok: false; message: string };

export type MarkAnswer = { ok: true } | { ok: false; message: string };

const markChange = z.object({ userId: z.number().int().positive(), admin: z.boolean() });

/** Makes a one-time account creation code for the signed-in admin, shown once. */
async function makeCodeAction(): Promise<CodeAnswer> {
    const { account } = await requireSession();
    return makeAccountCode(await authContext(), account);
}

/** Grants or removes an account's admin mark for the signed-in admin, giving this browser a new sign-in when the change is its own. */
async function setAdminMarkAction(userId: unknown, admin: unknown): Promise<MarkAnswer> {
    const change = markChange.safeParse({ userId, admin });
    const settings = webSettings();
    if (!change.success || settings === null) return { ok: false, message: MESSAGES.not_admin };
    const { account, session } = await requireSession();
    const actor = { account, session, address: await requestAddress(settings) };
    const answer = await setAdmin(await authContext(), actor, change.data);
    if (!answer.ok) return answer;
    if (answer.cookies !== null) await setSessionCookies(settings, answer.cookies);
    revalidatePath("/settings");
    return { ok: true };
}

export const makeAccountCodeNow = guarded(makeCodeAction, { admin: true, stepUp: true });
export const setAdminMark = guarded(setAdminMarkAction, { admin: true, stepUp: true });
