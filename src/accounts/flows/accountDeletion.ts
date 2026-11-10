import { deletionDate, mayRequestDeletion } from "../accountLifecycle.js";
import { checkEmail, normalizeEmail } from "../emails.js";
import { MESSAGES } from "../messages.js";
import type { Actor, AuthContext, Refused } from "./context.js";
import { recordSecurityEvent } from "./securityEvents.js";

/** Says whether the signed-in account holds the only admin mark. */
async function onlyAdmin(ctx: AuthContext, userId: number): Promise<boolean> {
    const admins = (await ctx.stores.accounts.accounts()).filter((account) => account.isAdmin);
    return admins.length === 1 && admins[0]?.id === userId;
}

/** Asks for the signed-in account to be deleted in 30 days once the typed email matches: it is deactivated at once and its Gmail connection removed through the given step; never the only admin. */
export async function requestDeletion(ctx: AuthContext, actor: Actor, disconnectGmail: () => Promise<void>, typedEmail: string): Promise<{ ok: true } | Refused> {
    const typed = checkEmail(typedEmail);
    const account = await ctx.stores.accounts.account(actor.account.id);
    if (account === null || !typed.ok || account.email === null || typed.emailKey !== normalizeEmail(account.email)) return { ok: false, message: MESSAGES.email_mismatch };
    if (!mayRequestDeletion(await onlyAdmin(ctx, account.id))) return { ok: false, message: MESSAGES.last_admin_delete };
    await ctx.stores.accounts.setStatus(account.id, { deactivatedAt: account.deactivatedAt ?? ctx.now(), deleteAfter: deletionDate(ctx.now()) });
    await disconnectGmail();
    await recordSecurityEvent(ctx, { userId: account.id, at: ctx.now(), address: actor.address, event: "deletion_requested", method: null });
    return { ok: true };
}

/** Calls off the signed-in account's pending deletion, leaving it deactivated. */
export async function cancelDeletion(ctx: AuthContext, actor: Actor): Promise<{ ok: true }> {
    const account = await ctx.stores.accounts.account(actor.account.id);
    if (account === null || account.deleteAfter === null) return { ok: true };
    await ctx.stores.accounts.setStatus(account.id, { deleteAfter: null });
    await recordSecurityEvent(ctx, { userId: account.id, at: ctx.now(), address: actor.address, event: "deletion_cancelled", method: null });
    return { ok: true };
}
