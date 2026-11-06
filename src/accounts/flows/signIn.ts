import type { Account } from "../../db/accountStore.js";
import { normalizeEmail } from "../emails.js";
import { attemptKey, limitFor, windowStart, type Limit } from "../limits.js";
import { MESSAGES } from "../messages.js";
import { standInDigest, verifyPassword } from "../passwordDigest.js";
import { newToken, tokenDigest } from "../tokens.js";
import type { AuthContext } from "./context.js";

export interface PasswordSignIn {
    email: string;
    password: string;
    address: string;
    heldDigest: string | null;
}

interface SessionCookies {
    session: string;
    csrf: string;
}

export type SignInAnswer = { ok: true; userId: number; cookies: SessionCookies } | { ok: false; message: string };

const REFUSED: SignInAnswer = { ok: false, message: MESSAGES.signin_failed };

/** Says whether an email or address has reached a limit's failures within its window. */
async function reached(ctx: AuthContext, limit: Limit, value: string): Promise<boolean> {
    return (await ctx.stores.sessions.countAttempts(attemptKey(limit, value), windowStart(limit, ctx.now()))) >= limit.max;
}

/** Records a failed sign-in for the email and address, noting on the account the moment the email locks. */
async function recordFailure(ctx: AuthContext, input: { emailKey: string; address: string; account: Account | null }): Promise<void> {
    const at = ctx.now();
    const emailLimit = limitFor("signinEmail");
    await ctx.stores.sessions.recordAttempt(attemptKey(emailLimit, input.emailKey), at);
    await ctx.stores.sessions.recordAttempt(attemptKey(limitFor("signinAddress"), input.address), at);
    if (input.account === null) return;
    const event = { userId: input.account.id, at, address: input.address, method: "password" };
    await ctx.stores.accounts.recordEvent({ ...event, event: "signin_failed" });
    const count = await ctx.stores.sessions.countAttempts(attemptKey(emailLimit, input.emailKey), windowStart(emailLimit, at));
    if (count === emailLimit.max) await ctx.stores.accounts.recordEvent({ ...event, event: "locked" });
}

/** Checks a password against the account's, or against the stand-in when there is no usable one, so both take as long. */
async function passwordMatches(ctx: AuthContext, account: Account | null, password: string): Promise<boolean> {
    const digest = account === null ? null : await ctx.stores.methods.passwordDigest(account.id);
    const matched = await verifyPassword(password, digest ?? (await standInDigest()));
    return matched && digest !== null;
}

/** Starts a new sign-in for an account, ending the one the browser held, and returns its cookie values. */
async function startSession(ctx: AuthContext, input: { userId: number; address: string; heldDigest: string | null }): Promise<SessionCookies> {
    const now = ctx.now();
    if (input.heldDigest !== null) await ctx.stores.sessions.end(input.heldDigest, now);
    await ctx.stores.sessions.pruneEnded(now);
    const cookies = { session: newToken(ctx.random), csrf: newToken(ctx.random) };
    await ctx.stores.sessions.create({ idDigest: tokenDigest(cookies.session), userId: input.userId, csrfDigest: tokenDigest(cookies.csrf), createdAt: now, lastUsedAt: now, verifiedAt: now, address: input.address });
    return cookies;
}

/** Signs in with an email and password, answering every failure, the limits included, with one fixed refusal. */
export async function signInWithPassword(ctx: AuthContext, input: PasswordSignIn): Promise<SignInAnswer> {
    const emailKey = normalizeEmail(input.email);
    const account = await ctx.stores.accounts.byEmailKey(emailKey);
    const limited = (await reached(ctx, limitFor("signinEmail"), emailKey)) || (await reached(ctx, limitFor("signinAddress"), input.address));
    const matched = await passwordMatches(ctx, account, input.password);
    if (limited || !matched || account === null) {
        await recordFailure(ctx, { emailKey, address: input.address, account });
        return REFUSED;
    }
    const cookies = await startSession(ctx, { userId: account.id, address: input.address, heldDigest: input.heldDigest });
    await ctx.stores.accounts.recordEvent({ userId: account.id, at: ctx.now(), address: input.address, event: "signed_in", method: "password" });
    return { ok: true, userId: account.id, cookies };
}

/** Ends one sign-in on the server. */
export async function signOut(ctx: AuthContext, sessionDigest: string): Promise<void> {
    await ctx.stores.sessions.end(sessionDigest, ctx.now());
}
