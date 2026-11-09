"use server";

import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation.js";
import { z } from "zod";
import { signInByWay } from "../../src/accounts/flows/signIn.js";
import * as keys from "../../src/accounts/ways/hardwareKey.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { safeReturnPath } from "../../src/accounts/returnPath.js";
import { parsedWith, signedInAction } from "./accountAction.js";
import { authContext } from "./authDeps.js";
import { webSettings } from "./webSettings.js";
import { guarded } from "./guard.js";
import { heldDigest, requestAddress, requestDevice, setSessionCookies } from "./requestAuth.js";

const name = z.string().max(200);

/** Starts adding a hardware key under a name, giving the browser its registration options. */
const startKeyRegistrationAction = signedInAction(
    (keyName: unknown) => parsedWith(name, keyName),
    ({ ctx, actor }, keyName) => keys.startKeyRegistration(ctx, actor, keyName),
);

/** Adds the key the browser registered, giving the first recovery codes to show once. */
const finishKeyRegistrationAction = signedInAction(
    (keyName: unknown, response: unknown) => {
        const parsed = parsedWith(name, keyName);
        return parsed === null ? null : { name: parsed, response };
    },
    async ({ ctx, actor }, key) => {
        const answer = await keys.finishKeyRegistration(ctx, actor, key);
        if (answer.ok) revalidatePath("/account");
        return answer;
    },
);

/** Deletes one of the account's hardware keys. */
const removeKeyAction = signedInAction(
    (id: unknown) => parsedWith(z.number().int().positive(), id),
    async ({ ctx, actor }, id) => {
        const answer = await keys.removeKey(ctx, actor, id);
        revalidatePath("/account");
        return answer;
    },
);

/** Gives the browser options to answer with any key, for signing in or confirming it's you. */
async function startKeySignInAction() {
    return keys.startKeySignIn(await authContext());
}

/** Signs in with the email typed and the key answer the form carries, then goes to the page asked for; every failure answers the same. */
async function finishKeySignInAction(form: FormData): Promise<{ message: string | null }> {
    const settings = webSettings();
    if (settings === null) return { message: MESSAGES.signin_failed };
    const response = JSON.parse(String(form.get("response") ?? "null")) as unknown;
    const request = { email: String(form.get("email") ?? ""), address: await requestAddress(settings), heldDigest: await heldDigest(settings), device: await requestDevice(settings, form) };
    const answer = await signInByWay(await authContext(), request, { kind: "hardware_key", fields: { response } });
    if (!answer.ok) return { message: answer.message };
    await setSessionCookies(settings, answer.cookies);
    redirect(safeReturnPath(String(form.get("next") ?? "")));
}

export const startKeyRegistration = guarded(startKeyRegistrationAction, { stepUp: true });
export const finishKeyRegistration = guarded(finishKeyRegistrationAction, { stepUp: true });
export const removeKey = guarded(removeKeyAction, { stepUp: true });
export const startKeySignIn = guarded(startKeySignInAction, { public: true });
export const finishKeySignIn = guarded(finishKeySignInAction, { public: true });
