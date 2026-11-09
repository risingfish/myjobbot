import type { z } from "zod";
import type { Actor, AuthContext, Refused } from "../../src/accounts/flows/context.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { actorNow } from "./actor.js";
import { authContext } from "./authDeps.js";
import { type WebSettings } from "./webSettings.js";

const SIGNED_OUT: Refused = { ok: false, message: MESSAGES.signed_out };

interface SignedIn {
    ctx: AuthContext;
    actor: Actor;
    settings: WebSettings;
}

/** Builds an account action: it reads its input, finds the signed-in account, and answers with the refusal given (signed out unless another is named) when either is missing, else runs for that account. */
export function signedInAction<A extends unknown[], I, R>(parse: (...args: A) => I | null, run: (signedIn: SignedIn, input: I) => Promise<R>, refusal: Refused = SIGNED_OUT): (...args: A) => Promise<R | Refused> {
    return async (...args) => {
        const input = parse(...args);
        const now = await actorNow();
        if (input === null || now === null) return refusal;
        return run({ ctx: await authContext(), ...now }, input);
    };
}

/** Reads a value through a schema, giving null when it doesn't fit. */
export function parsedWith<T>(schema: z.ZodType<T>, value: unknown): T | null {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

/** Reads no input, for actions that take none. */
export function noInput(): true {
    return true;
}
