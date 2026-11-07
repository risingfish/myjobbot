"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import * as app from "../../src/accounts/ways/authenticator.js";
import { makeRecoveryCodes as makeCodes } from "../../src/accounts/ways/recoveryCode.js";
import { noInput, parsedWith, signedInAction } from "./accountAction.js";
import { guarded } from "./guard.js";

const appCode = z.string().max(20);

/** Starts setting up an authenticator app, giving the QR code and the secret to show once. */
const startAuthenticatorSetupAction = signedInAction(noInput, ({ ctx, actor }) => app.startAuthenticatorSetup(ctx, actor));

/** Finishes the authenticator setup with a code from the app, giving the first recovery codes to show once. */
const confirmAuthenticatorAction = signedInAction(
    (code: unknown) => parsedWith(appCode, code),
    async ({ ctx, actor }, code) => {
        const answer = await app.confirmAuthenticator(ctx, actor, code);
        if (answer.ok) revalidatePath("/account");
        return answer;
    },
);

/** Removes the account's authenticator app. */
const removeAuthenticatorAction = signedInAction(noInput, async ({ ctx, actor }) => {
    const answer = await app.removeAuthenticator(ctx, actor);
    revalidatePath("/account");
    return answer;
});

/** Makes a new set of recovery codes, replacing the old set, to show once. */
const makeRecoveryCodesAction = signedInAction(noInput, async ({ ctx, actor }) => {
    const answer = await makeCodes(ctx, actor);
    revalidatePath("/account");
    return answer;
});

export const startAuthenticatorSetup = guarded(startAuthenticatorSetupAction, { stepUp: true });
export const confirmAuthenticator = guarded(confirmAuthenticatorAction, { stepUp: true });
export const removeAuthenticator = guarded(removeAuthenticatorAction, { stepUp: true });
export const makeRecoveryCodes = guarded(makeRecoveryCodesAction, { stepUp: true });
