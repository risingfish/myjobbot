import type { Account } from "../../db/accountStore.js";
import { normalizeEmail } from "../emails.js";
import { attemptKey, limitFor, windowStart, type Limit } from "../limits.js";
import type { Actor, AuthContext } from "./context.js";
import { recordSecurityEvent } from "./securityEvents.js";

export interface PasswordTry {
    emailKey: string;
    address: string;
    account: Account | null;
    method?: string;
}

/** Says whether an email or address has reached a limit's failures within its window. */
async function reached(ctx: AuthContext, limit: Limit, value: string): Promise<boolean> {
    return (await ctx.stores.sessions.countAttempts(attemptKey(limit, value), windowStart(limit, ctx.now()))) >= limit.max;
}

/** Says whether sign-in is locked for this email or address by too many recent failures. */
export async function signInLocked(ctx: AuthContext, attempt: PasswordTry): Promise<boolean> {
    return (await reached(ctx, limitFor("signinEmail"), attempt.emailKey)) || (await reached(ctx, limitFor("signinAddress"), attempt.address));
}

/** Records a failed sign-in, by any way, for the email and address, noting on the account the moment the email locks. */
export async function recordFailure(ctx: AuthContext, attempt: PasswordTry): Promise<void> {
    const at = ctx.now();
    const emailLimit = limitFor("signinEmail");
    await ctx.stores.sessions.recordAttempt(attemptKey(emailLimit, attempt.emailKey), at);
    await ctx.stores.sessions.recordAttempt(attemptKey(limitFor("signinAddress"), attempt.address), at);
    if (attempt.account === null) return;
    const event = { userId: attempt.account.id, at, address: attempt.address, method: attempt.method ?? "password" };
    await recordSecurityEvent(ctx, { ...event, event: "signin_failed" });
    const count = await ctx.stores.sessions.countAttempts(attemptKey(emailLimit, attempt.emailKey), windowStart(emailLimit, at));
    if (count === emailLimit.max) await recordSecurityEvent(ctx, { ...event, event: "locked" });
}

/** Describes a signed-in account's own try at proving itself again, for the sign-in limits. */
export function actorTry(actor: Actor, method: string): PasswordTry {
    return { emailKey: normalizeEmail(actor.account.email ?? ""), address: actor.address, account: actor.account, method };
}
