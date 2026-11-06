import type { Account } from "../../db/accountStore.js";
import { CODE_DAYS, daysAfter } from "../../db/tokenStore.js";
import { MESSAGES } from "../messages.js";
import { newToken, tokenDigest } from "../tokens.js";
import type { Actor, AuthContext } from "./context.js";
import { recordSecurityEvent } from "./securityEvents.js";
import { startSession, type SessionCookies } from "./signIn.js";

type Refused = { ok: false; message: string };

const NOT_ADMIN: Refused = { ok: false, message: MESSAGES.not_admin };

/** Makes a one-time account creation code for an admin, kept only as its digest, and shows it once with its expiry. */
export async function makeAccountCode(ctx: AuthContext, admin: Account): Promise<{ ok: true; code: string; expiresAt: string } | Refused> {
    if (!admin.isAdmin) return NOT_ADMIN;
    const code = newToken(ctx.random);
    const now = ctx.now();
    await ctx.stores.tokens.makeCode(tokenDigest(code), admin.id, now);
    await recordSecurityEvent(ctx, { userId: admin.id, at: now, address: null, event: "code_made", method: null });
    return { ok: true, code, expiresAt: daysAfter(now, CODE_DAYS) };
}

/** Ends the sign-ins an admin-mark change touches: the target's, or, for an admin's own change, every other one, giving this browser a new sign-in. */
async function endSessionsAfter(ctx: AuthContext, actor: Actor, userId: number): Promise<SessionCookies | null> {
    if (userId !== actor.account.id) {
        await ctx.stores.sessions.endAllFor(userId, ctx.now());
        return null;
    }
    const cookies = await startSession(ctx, { userId, address: actor.address, heldDigest: actor.session.idDigest, device: actor.session.device });
    await ctx.stores.sessions.endAllFor(userId, ctx.now(), tokenDigest(cookies.session));
    return cookies;
}

/** Grants or removes an account's admin mark for an admin, never leaving no admin, and ends the sign-ins the change touches. */
export async function setAdmin(ctx: AuthContext, actor: Actor, change: { userId: number; admin: boolean }): Promise<{ ok: true; cookies: SessionCookies | null } | Refused> {
    if (!actor.account.isAdmin) return NOT_ADMIN;
    if ((await ctx.stores.accounts.setAdmin(change.userId, change.admin)) === "last_admin") return { ok: false, message: MESSAGES.last_admin };
    await recordSecurityEvent(ctx, { userId: change.userId, at: ctx.now(), address: actor.address, event: change.admin ? "admin_granted" : "admin_removed", method: null });
    return { ok: true, cookies: await endSessionsAfter(ctx, actor, change.userId) };
}
