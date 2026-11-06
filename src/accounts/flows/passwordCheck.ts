import type { Account } from "../../db/accountStore.js";
import { attemptKey, limitFor, windowStart, type Limit } from "../limits.js";
import { standInDigest, verifyPassword } from "../passwordDigest.js";
import type { AuthContext } from "./context.js";
import { recordSecurityEvent } from "./securityEvents.js";

export interface PasswordTry {
    emailKey: string;
    address: string;
    account: Account | null;
}

/** Says whether an email or address has reached a limit's failures within its window. */
async function reached(ctx: AuthContext, limit: Limit, value: string): Promise<boolean> {
    return (await ctx.stores.sessions.countAttempts(attemptKey(limit, value), windowStart(limit, ctx.now()))) >= limit.max;
}

/** Says whether sign-in is locked for this email or address by too many recent failures. */
export async function signInLocked(ctx: AuthContext, attempt: PasswordTry): Promise<boolean> {
    return (await reached(ctx, limitFor("signinEmail"), attempt.emailKey)) || (await reached(ctx, limitFor("signinAddress"), attempt.address));
}

/** Records a failed sign-in for the email and address, noting on the account the moment the email locks. */
export async function recordFailure(ctx: AuthContext, attempt: PasswordTry): Promise<void> {
    const at = ctx.now();
    const emailLimit = limitFor("signinEmail");
    await ctx.stores.sessions.recordAttempt(attemptKey(emailLimit, attempt.emailKey), at);
    await ctx.stores.sessions.recordAttempt(attemptKey(limitFor("signinAddress"), attempt.address), at);
    if (attempt.account === null) return;
    const event = { userId: attempt.account.id, at, address: attempt.address, method: "password" };
    await recordSecurityEvent(ctx, { ...event, event: "signin_failed" });
    const count = await ctx.stores.sessions.countAttempts(attemptKey(emailLimit, attempt.emailKey), windowStart(emailLimit, at));
    if (count === emailLimit.max) await recordSecurityEvent(ctx, { ...event, event: "locked" });
}

/** Checks a password against the account's, or against the stand-in when there is no usable one, so both take as long. */
export async function passwordMatches(ctx: AuthContext, account: Account | null, password: string): Promise<boolean> {
    const digest = account === null ? null : await ctx.stores.methods.passwordDigest(account.id);
    const matched = await verifyPassword(password, digest ?? (await standInDigest()));
    return matched && digest !== null;
}
