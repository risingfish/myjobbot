"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import * as changes from "../../src/accounts/flows/accountChanges.js";
import { confirmIdentity as confirm, type IdentityProof } from "../../src/accounts/flows/confirmIdentity.js";
import * as links from "../../src/accounts/flows/emailLinks.js";
import { CARD_KINDS, CHOICE_KINDS } from "../../src/accounts/ways/catalog.js";
import { changePassword as changePasswordFor } from "../../src/accounts/ways/password.js";
import { PROOF_WAYS } from "../../src/accounts/ways/registry.js";
import type { MethodKind } from "../../src/db/methodStore.js";
import { noInput, parsedWith, signedInAction } from "./accountAction.js";
import { guarded } from "./guard.js";
import { setSessionCookies } from "./requestAuth.js";

export type AccountAnswer = { ok: true; setup?: MethodKind; message?: string } | { ok: false; message: string; stepUp?: true };

const text = z.string().max(1000);
const methodChange = z.object({ kind: z.enum(CARD_KINDS), enabled: z.boolean() });
const passwords = z.object({ current: text, next: text });
const deviceRef = z.string().regex(/^[0-9a-f]{16}$/);

/** Reads the text an action was given, at most 1,000 characters. */
function textInput(value: unknown): string | null {
    return parsedWith(text, value);
}

/** Saves the signed-in account's new name, shown again in the header. */
const saveNameAction = signedInAction(textInput, async ({ ctx, actor }, name): Promise<AccountAnswer> => {
    const answer = await changes.saveName(ctx, actor, name);
    if (answer.ok) revalidatePath("/", "layout");
    return answer;
});

/** Changes the password given the current one, keeping this browser signed in on a new sign-in. */
const changePasswordAction = signedInAction(
    (current: unknown, next: unknown) => parsedWith(passwords, { current, next }),
    async ({ ctx, actor, settings }, input): Promise<AccountAnswer> => {
        const answer = await changePasswordFor(ctx, actor, input);
        if (!answer.ok) return answer;
        await setSessionCookies(settings, answer.cookies);
        revalidatePath("/account");
        return { ok: true };
    },
);

/** Switches one way of signing in on or off. */
const setMethodEnabledAction = signedInAction(
    (kind: unknown, enabled: unknown) => parsedWith(methodChange, { kind, enabled }),
    async ({ ctx, actor }, change): Promise<AccountAnswer> => {
        const answer = await changes.setMethodEnabled(ctx, actor, change);
        revalidatePath("/account");
        return answer;
    },
);

/** Ends every sign-in of the account but this browser's. */
const signOutEverywhereElseAction = signedInAction(noInput, async ({ ctx, actor }): Promise<AccountAnswer> => {
    await changes.signOutEverywhereElse(ctx, actor);
    revalidatePath("/account");
    return { ok: true };
});

/** Signs one of the account's other devices out. */
const signOutDeviceAction = signedInAction(
    (ref: unknown) => parsedWith(deviceRef, ref),
    async ({ ctx, actor }, ref): Promise<AccountAnswer> => {
        const answer = await changes.signOutDevice(ctx, actor, ref);
        revalidatePath("/account");
        return answer;
    },
);

/** Mails the test email to the signed-in account. */
const sendTestEmailAction = signedInAction(noInput, ({ ctx, actor }): Promise<AccountAnswer> => links.sendTestEmail(ctx, actor));

/** Mails a link confirming a new email to that address; nothing changes until it is opened. */
const requestEmailChangeAction = signedInAction(textInput, ({ ctx, actor }, email): Promise<AccountAnswer> => links.requestEmailChange(ctx, actor, email));

/** Mails a confirm-it's-you link for this browser, returning afterwards to the page it was asked from. */
const requestStepUpLinkAction = signedInAction(textInput, ({ ctx, actor }, returnPath): Promise<AccountAnswer> => links.requestStepUpLink(ctx, actor, returnPath));

/** Reads a proof of identity for the way named, through that way's own reading of the value given. */
function identityProof(method: unknown, value: unknown): IdentityProof | null {
    const kind = CHOICE_KINDS.find((choice) => choice === method);
    if (kind === undefined) return null;
    const typed = textInput(value) ?? undefined;
    const proof = PROOF_WAYS[kind].readProof({ password: typed, code: typed, response: value });
    return proof === null ? null : { method: kind, ...proof };
}

/** Proves the signed-in account's identity again by its password, an app code, a recovery code or a key, so sensitive changes go through for the next 10 minutes. */
const confirmIdentityAction = signedInAction(identityProof, ({ ctx, actor }, proof): Promise<AccountAnswer> => confirm(ctx, actor, proof));

export const saveName = guarded(saveNameAction, {});
export const changePassword = guarded(changePasswordAction, { stepUp: true });
export const setMethodEnabled = guarded(setMethodEnabledAction, { stepUp: true });
export const signOutEverywhereElse = guarded(signOutEverywhereElseAction, { stepUp: true });
export const signOutDevice = guarded(signOutDeviceAction, {});
export const confirmIdentity = guarded(confirmIdentityAction, {});
export const sendTestEmail = guarded(sendTestEmailAction, {});
export const requestEmailChange = guarded(requestEmailChangeAction, { stepUp: true });
export const requestStepUpLink = guarded(requestStepUpLinkAction, {});
