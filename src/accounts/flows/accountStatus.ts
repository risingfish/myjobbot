import { MESSAGES } from "../messages.js";
import type { Actor, AuthContext, Refused } from "./context.js";
import { recordSecurityEvent } from "./securityEvents.js";

/** Deactivates the signed-in account: runs stop working for it and its Gmail connection is removed through the given step, while sign-in keeps working. */
export async function deactivate(ctx: AuthContext, actor: Actor, disconnectGmail: () => Promise<void>): Promise<{ ok: true }> {
    const account = await ctx.stores.accounts.account(actor.account.id);
    await disconnectGmail();
    if (account === null || account.deactivatedAt !== null) return { ok: true };
    await ctx.stores.accounts.setStatus(account.id, { deactivatedAt: ctx.now(), deleteAfter: null });
    await recordSecurityEvent(ctx, { userId: account.id, at: ctx.now(), address: actor.address, event: "account_deactivated", method: null });
    return { ok: true };
}

/** Reactivates the signed-in account so runs work for it again, refusing while a deletion is pending. */
export async function reactivate(ctx: AuthContext, actor: Actor): Promise<{ ok: true } | Refused> {
    const account = await ctx.stores.accounts.account(actor.account.id);
    if (account === null || account.deactivatedAt === null) return { ok: true };
    if (account.deleteAfter !== null) return { ok: false, message: MESSAGES.deletion_pending };
    await ctx.stores.accounts.setStatus(account.id, { deactivatedAt: null, deleteAfter: null });
    await recordSecurityEvent(ctx, { userId: account.id, at: ctx.now(), address: actor.address, event: "account_reactivated", method: null });
    return { ok: true };
}
