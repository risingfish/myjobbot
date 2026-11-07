import type { Account } from "../../db/accountStore.js";
import { MESSAGES } from "../messages.js";
import { digestPassword, standInDigest, verifyPassword } from "../passwordDigest.js";
import { checkPassword } from "../passwordRule.js";
import { tokenDigest } from "../tokens.js";
import { actorTry, recordFailure, signInLocked } from "../flows/attempts.js";
import type { Actor, AuthContext, Refused } from "../flows/context.js";
import { recordSecurityEvent } from "../flows/securityEvents.js";
import { startSession, type SessionCookies } from "../flows/sessions.js";
import type { ProofWay } from "./registry.js";

/** Checks a password against the account's, or against the stand-in when there is no usable one, so both take as long. */
async function passwordMatches(ctx: AuthContext, account: Account | null, password: string): Promise<boolean> {
    const digest = account === null ? null : await ctx.stores.methods.passwordDigest(account.id);
    const matched = await verifyPassword(password, digest ?? (await standInDigest()));
    return matched && digest !== null;
}

export const passwordWay: ProofWay = {
    kind: "password",
    readProof: (fields) => (typeof fields.password === "string" ? { password: fields.password } : null),
    matches: (ctx, account, proof) => passwordMatches(ctx, account, proof.password ?? ""),
};

/** Checks a new password against the rule and gives its digest, or the rule's message when it falls short. */
export async function newPasswordDigest(raw: string): Promise<{ ok: true; digest: string } | Refused> {
    const problem = checkPassword(raw);
    return problem === null ? { ok: true, digest: await digestPassword(raw) } : { ok: false, message: problem };
}

/** Checks a signed-in account's current password under the sign-in limits, so a held session can't be used to guess it. */
async function currentPasswordMatches(ctx: AuthContext, actor: Actor, password: string): Promise<boolean> {
    const attempt = actorTry(actor, "password");
    if (!(await signInLocked(ctx, attempt)) && (await passwordMatches(ctx, actor.account, password))) return true;
    await recordFailure(ctx, attempt);
    return false;
}

/** Changes the password given the current one, ending every other sign-in and giving this browser a new one. */
export async function changePassword(ctx: AuthContext, actor: Actor, input: { current: string; next: string }): Promise<{ ok: true; cookies: SessionCookies } | Refused> {
    if (!(await currentPasswordMatches(ctx, actor, input.current))) return { ok: false, message: MESSAGES.current_password };
    const next = await newPasswordDigest(input.next);
    if (!next.ok) return next;
    await ctx.stores.methods.setPassword(actor.account.id, next.digest, ctx.now());
    const cookies = await startSession(ctx, { userId: actor.account.id, address: actor.address, heldDigest: actor.session.idDigest, device: actor.session.device });
    await ctx.stores.sessions.endAllFor(actor.account.id, ctx.now(), tokenDigest(cookies.session));
    await recordSecurityEvent(ctx, { userId: actor.account.id, at: ctx.now(), address: actor.address, event: "password_changed", method: "password" });
    return { ok: true, cookies };
}
