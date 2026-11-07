"use server";

import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation.js";
import { z } from "zod";
import * as keys from "../../src/accounts/flows/keys.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { safeReturnPath } from "../../src/accounts/returnPath.js";
import { actorNow } from "./actor.js";
import { authContext, webSettings } from "./authDeps.js";
import { guarded } from "./guard.js";
import { heldDigest, requestAddress, requestDevice, setSessionCookies } from "./requestAuth.js";

type Refused = { ok: false; message: string };

const SIGNED_OUT: Refused = { ok: false, message: MESSAGES.signed_out };
const name = z.string().max(200);

/** Starts adding a hardware key under a name, giving the browser its registration options. */
async function startKeyRegistrationAction(keyName: unknown) {
    const parsed = name.safeParse(keyName);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    return keys.startKeyRegistration(await authContext(), now.actor, parsed.data);
}

/** Adds the key the browser registered, giving the first recovery codes to show once. */
async function finishKeyRegistrationAction(keyName: unknown, response: unknown) {
    const parsed = name.safeParse(keyName);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    const answer = await keys.finishKeyRegistration(await authContext(), now.actor, { name: parsed.data, response });
    if (answer.ok) revalidatePath("/account");
    return answer;
}

/** Deletes one of the account's hardware keys. */
async function removeKeyAction(id: unknown) {
    const parsed = z.number().int().positive().safeParse(id);
    const now = await actorNow();
    if (!parsed.success || now === null) return SIGNED_OUT;
    const answer = await keys.removeKey(await authContext(), now.actor, parsed.data);
    revalidatePath("/account");
    return answer;
}

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
    const answer = await keys.finishKeySignIn(await authContext(), { ...request, response });
    if (!answer.ok) return { message: answer.message };
    await setSessionCookies(settings, answer.cookies);
    redirect(safeReturnPath(String(form.get("next") ?? "")));
}

export const startKeyRegistration = guarded(startKeyRegistrationAction, { stepUp: true });
export const finishKeyRegistration = guarded(finishKeyRegistrationAction, { stepUp: true });
export const removeKey = guarded(removeKeyAction, { stepUp: true });
export const startKeySignIn = guarded(startKeySignInAction, { public: true });
export const finishKeySignIn = guarded(finishKeySignInAction, { public: true });
