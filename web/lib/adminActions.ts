"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import { adminChangeEmail as changeEmail, makeAccountCode, setAdmin } from "../../src/accounts/flows/admin.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { noInput, parsedWith, signedInAction } from "./accountAction.js";
import { guarded } from "./guard.js";
import { setSessionCookies } from "./requestAuth.js";

export type CodeAnswer = { ok: true; code: string; expiresAt: string } | { ok: false; message: string };

export type MarkAnswer = { ok: true } | { ok: false; message: string };

const markChange = z.object({ userId: z.number().int().positive(), admin: z.boolean() });
const emailChange = z.object({ userId: z.number().int().positive(), email: z.string().max(1000) });

/** Makes a one-time account creation code for the signed-in admin, shown once. */
const makeCodeAction = signedInAction(noInput, ({ ctx, actor }) => makeAccountCode(ctx, actor.account));

/** Grants or removes an account's admin mark for the signed-in admin, giving this browser a new sign-in when the change is its own. */
const setAdminMarkAction = signedInAction(
    (userId: unknown, admin: unknown) => parsedWith(markChange, { userId, admin }),
    async ({ ctx, actor, settings }, change): Promise<MarkAnswer> => {
        const answer = await setAdmin(ctx, actor, change);
        if (!answer.ok) return answer;
        if (answer.cookies !== null) await setSessionCookies(settings, answer.cookies);
        revalidatePath("/settings");
        return { ok: true };
    },
    { ok: false, message: MESSAGES.not_admin },
);

/** Changes another account's email at once for the signed-in admin. */
const adminChangeEmailAction = signedInAction(
    (userId: unknown, email: unknown) => parsedWith(emailChange, { userId, email }),
    async ({ ctx, actor }, change): Promise<MarkAnswer> => {
        const answer = await changeEmail(ctx, actor, change);
        if (answer.ok) revalidatePath("/settings");
        return answer;
    },
    { ok: false, message: MESSAGES.email_invalid },
);

export const makeAccountCodeNow = guarded(makeCodeAction, { admin: true, stepUp: true });
export const setAdminMark = guarded(setAdminMarkAction, { admin: true, stepUp: true });
export const adminChangeEmail = guarded(adminChangeEmailAction, { admin: true, stepUp: true });
