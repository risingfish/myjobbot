import { normalizeEmail } from "../emails.js";
import { MESSAGES } from "../messages.js";
import type { Account } from "../../db/accountStore.js";
import type { Device } from "../../db/sessionStore.js";
import type { AuthContext } from "./context.js";
import { recordFailure, signInLocked } from "./attempts.js";
import { passwordMatches } from "./passwordCheck.js";
import { recordSecurityEvent } from "./securityEvents.js";
import { startSession, type SessionCookies } from "./sessions.js";

export interface PasswordSignIn {
    email: string;
    password: string;
    address: string;
    heldDigest: string | null;
    device?: Device;
}

export type SignInAnswer = { ok: true; userId: number; cookies: SessionCookies } | { ok: false; message: string };

const REFUSED: SignInAnswer = { ok: false, message: MESSAGES.signin_failed };

export type SignInRequest = Omit<PasswordSignIn, "password">;

export interface SignInWay {
    method: string;
    matches: (account: Account | null) => Promise<boolean>;
}

/** Signs in by one way for an email, under the shared limits, answering every failure with one fixed refusal and recording it against that way. */
export async function signInWith(ctx: AuthContext, input: SignInRequest, way: SignInWay): Promise<SignInAnswer> {
    const emailKey = normalizeEmail(input.email);
    const account = await ctx.stores.accounts.byEmailKey(emailKey);
    const attempt = { emailKey, address: input.address, account, method: way.method };
    const locked = await signInLocked(ctx, attempt);
    const matched = !locked && (await way.matches(account));
    if (!matched || account === null) {
        await recordFailure(ctx, attempt);
        return REFUSED;
    }
    const cookies = await startSession(ctx, { userId: account.id, address: input.address, heldDigest: input.heldDigest, device: input.device });
    await recordSecurityEvent(ctx, { userId: account.id, at: ctx.now(), address: input.address, event: "signed_in", method: way.method });
    return { ok: true, userId: account.id, cookies };
}

/** Signs in with an email and password; an unknown email is checked against the stand-in digest so every answer takes as long. */
export function signInWithPassword(ctx: AuthContext, input: PasswordSignIn): Promise<SignInAnswer> {
    return signInWith(ctx, input, { method: "password", matches: (account) => passwordMatches(ctx, account, input.password) });
}

/** Ends one sign-in on the server. */
export async function signOut(ctx: AuthContext, sessionDigest: string): Promise<void> {
    await ctx.stores.sessions.end(sessionDigest, ctx.now());
}
