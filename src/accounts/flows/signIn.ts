import { normalizeEmail } from "../emails.js";
import { MESSAGES } from "../messages.js";
import type { Account } from "../../db/accountStore.js";
import type { Device } from "../../db/sessionStore.js";
import { newToken, tokenDigest } from "../tokens.js";
import type { AuthContext } from "./context.js";
import { passwordMatches, recordFailure, signInLocked } from "./passwordCheck.js";
import { recordSecurityEvent } from "./securityEvents.js";

export interface PasswordSignIn {
    email: string;
    password: string;
    address: string;
    heldDigest: string | null;
    device?: Device;
}

const UNKNOWN_DEVICE: Device = { ip: null, os: null, location: null };

export interface SessionCookies {
    session: string;
    csrf: string;
}

export type SignInAnswer = { ok: true; userId: number; cookies: SessionCookies } | { ok: false; message: string };

const REFUSED: SignInAnswer = { ok: false, message: MESSAGES.signin_failed };

/** Starts a new sign-in for an account, ending the one the browser held, and returns its cookie values. */
export async function startSession(ctx: AuthContext, input: { userId: number; address: string; heldDigest: string | null; device?: Device }): Promise<SessionCookies> {
    const now = ctx.now();
    if (input.heldDigest !== null) await ctx.stores.sessions.end(input.heldDigest, now);
    await ctx.stores.sessions.pruneEnded(now);
    const cookies = { session: newToken(ctx.random), csrf: newToken(ctx.random) };
    await ctx.stores.sessions.create({ idDigest: tokenDigest(cookies.session), userId: input.userId, csrfDigest: tokenDigest(cookies.csrf), createdAt: now, lastUsedAt: now, verifiedAt: now, address: input.address, device: input.device ?? UNKNOWN_DEVICE });
    return cookies;
}

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
