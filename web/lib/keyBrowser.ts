import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { MESSAGES } from "../../src/accounts/messages.js";
import { finishKeyRegistration, finishKeySignIn, startKeyRegistration, startKeySignIn } from "./keyActions.js";

type Answer = { ok: true; recoveryCodes?: string[] | null } | { ok: false; message: string; stepUp?: true };

/** Asks the browser for any of this site's keys, giving its answer, or null when there is no key or the person cancels. */
export async function keyAnswer(): Promise<unknown> {
    const options = await startKeySignIn();
    if (!options.ok) return null;
    try {
        return await startAuthentication({ optionsJSON: options.options });
    } catch {
        return null;
    }
}

/** Adds a key under a name: the server's options, the browser's registration with the key, then the server's check. */
export async function addKey(name: string): Promise<Answer> {
    const started = await startKeyRegistration(name);
    if (!started.ok) return started;
    try {
        const response = await startRegistration({ optionsJSON: started.options });
        return await finishKeyRegistration(name, response);
    } catch {
        return { ok: false, message: MESSAGES.key_failed };
    }
}

/** Signs in with a key for the email on the form, carrying the key's answer in the form; a key that answers nothing gets the one fixed refusal. */
export async function signInWithKey(form: FormData): Promise<{ message: string | null }> {
    const response = await keyAnswer();
    if (response === null) return { message: MESSAGES.signin_failed };
    form.set("response", JSON.stringify(response));
    return finishKeySignIn(form);
}
