"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import * as app from "../../src/accounts/ways/authenticator.js";
import { makeRecoveryCodes as makeCodes } from "../../src/accounts/ways/recoveryCode.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { actorNow } from "./actor.js";
import { authContext } from "./authDeps.js";
import { guarded } from "./guard.js";

type Refused = { ok: false; message: string };

const SIGNED_OUT: Refused = { ok: false, message: MESSAGES.signed_out };

/** Starts setting up an authenticator app, giving the QR code and the secret to show once. */
async function startAuthenticatorSetupAction(): Promise<{ ok: true; qr: string; secret: string } | Refused> {
    const now = await actorNow();
    return now === null ? SIGNED_OUT : app.startAuthenticatorSetup(await authContext(), now.actor);
}

/** Finishes the authenticator setup with a code from the app, giving the first recovery codes to show once. */
async function confirmAuthenticatorAction(code: unknown): Promise<{ ok: true; recoveryCodes: string[] | null } | Refused> {
    const parsed = z.string().max(20).safeParse(code);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    const answer = await app.confirmAuthenticator(await authContext(), now.actor, parsed.data);
    if (answer.ok) revalidatePath("/account");
    return answer;
}

/** Removes the account's authenticator app. */
async function removeAuthenticatorAction(): Promise<{ ok: true } | Refused> {
    const now = await actorNow();
    if (now === null) return SIGNED_OUT;
    const answer = await app.removeAuthenticator(await authContext(), now.actor);
    revalidatePath("/account");
    return answer;
}

/** Makes a new set of recovery codes, replacing the old set, to show once. */
async function makeRecoveryCodesAction(): Promise<{ ok: true; codes: string[] } | Refused> {
    const now = await actorNow();
    if (now === null) return SIGNED_OUT;
    const answer = await makeCodes(await authContext(), now.actor);
    revalidatePath("/account");
    return answer;
}

export const startAuthenticatorSetup = guarded(startAuthenticatorSetupAction, { stepUp: true });
export const confirmAuthenticator = guarded(confirmAuthenticatorAction, { stepUp: true });
export const removeAuthenticator = guarded(removeAuthenticatorAction, { stepUp: true });
export const makeRecoveryCodes = guarded(makeRecoveryCodesAction, { stepUp: true });
