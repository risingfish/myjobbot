import type { Device } from "../../db/sessionStore.js";
import { emailChanged } from "../../mail/messages.js";
import { checkEmail } from "../emails.js";
import { MESSAGES } from "../messages.js";
import { digestPassword } from "../passwordDigest.js";
import { checkPassword } from "../passwordRule.js";
import { tokenDigest } from "../tokens.js";
import { wayUsable } from "../ways/usable.js";
import type { AuthContext } from "./context.js";
import { mailTo } from "./mail.js";
import { recordSecurityEvent } from "./securityEvents.js";
import { startSession, type SessionCookies } from "./sessions.js";

export interface LinkSpend {
    token: string;
    password?: string;
    sessionDigest: string | null;
    address: string;
    heldDigest: string | null;
    device?: Device;
}

export type SpendAnswer = { ok: true; kind: "signin"; cookies: SessionCookies } | { ok: true; kind: "reset" } | { ok: true; kind: "email_change" } | { ok: true; kind: "step_up"; next: string } | { ok: false; message: string };

const EXPIRED: SpendAnswer = { ok: false, message: MESSAGES.link_expired };

/** Records a security event an opened link caused. */
function record(ctx: AuthContext, input: { userId: number; address: string; event: "signed_in" | "password_reset" | "email_changed"; method: string | null }): Promise<void> {
    return recordSecurityEvent(ctx, { userId: input.userId, at: ctx.now(), address: input.address, event: input.event, method: input.method });
}

/** Signs in with a sign-in link, once, and only while the account still has email links usable. */
export async function spendSignIn(ctx: AuthContext, spend: LinkSpend): Promise<SpendAnswer> {
    const spent = await ctx.stores.tokens.spendEmailToken({ digest: tokenDigest(spend.token), purpose: "signin" }, ctx.now());
    if (spent === null || !(await wayUsable(ctx, spent.userId, "email_link"))) return EXPIRED;
    const cookies = await startSession(ctx, { userId: spent.userId, address: spend.address, heldDigest: spend.heldDigest, device: spend.device });
    await record(ctx, { userId: spent.userId, address: spend.address, event: "signed_in", method: "email_link" });
    return { ok: true, kind: "signin", cookies };
}

/** Sets a new password with a reset link, checking it first so a weak one leaves the link working, and ends every sign-in; it signs no one in. */
export async function spendReset(ctx: AuthContext, spend: LinkSpend): Promise<SpendAnswer> {
    const problem = checkPassword(spend.password ?? "");
    if (problem !== null) return { ok: false, message: problem };
    const spent = await ctx.stores.tokens.spendEmailToken({ digest: tokenDigest(spend.token), purpose: "reset" }, ctx.now());
    if (spent === null) return EXPIRED;
    await ctx.stores.methods.setPassword(spent.userId, await digestPassword(spend.password ?? ""), ctx.now());
    await ctx.stores.sessions.endAllFor(spent.userId, ctx.now());
    await record(ctx, { userId: spent.userId, address: spend.address, event: "password_reset", method: "password" });
    return { ok: true, kind: "reset" };
}

/** Changes the email with the link sent to the new address, telling the old one, unless another account took the address meanwhile. */
export async function spendEmailChange(ctx: AuthContext, spend: LinkSpend): Promise<SpendAnswer> {
    const spent = await ctx.stores.tokens.spendEmailToken({ digest: tokenDigest(spend.token), purpose: "email_change" }, ctx.now());
    const account = spent === null ? null : await ctx.stores.accounts.account(spent.userId);
    const email = checkEmail(spent?.newEmail ?? "");
    if (spent === null || account === null || !email.ok) return EXPIRED;
    if ((await ctx.stores.accounts.changeEmail(account.id, email.email, email.emailKey)) === "taken") return { ok: false, message: MESSAGES.email_taken };
    if (account.email) mailTo(ctx, account.email, () => emailChanged(account.name));
    await record(ctx, { userId: account.id, address: spend.address, event: "email_changed", method: null });
    return { ok: true, kind: "email_change" };
}

/** Renews the proof of identity of the sign-in that asked for a confirm link; opened anywhere else, it spends nothing. */
export async function spendStepUp(ctx: AuthContext, spend: LinkSpend): Promise<SpendAnswer> {
    const digest = tokenDigest(spend.token);
    const spent = spend.sessionDigest === null ? null : await ctx.stores.tokens.spendEmailToken({ digest, purpose: "step_up", sessionDigest: spend.sessionDigest }, ctx.now());
    if (spent === null || spend.sessionDigest === null) {
        const found = await ctx.stores.tokens.emailTokenFor(digest, ctx.now());
        return found?.live && found.purpose === "step_up" ? { ok: false, message: MESSAGES.step_up_other_browser } : EXPIRED;
    }
    await ctx.stores.sessions.setVerified(spend.sessionDigest, ctx.now());
    return { ok: true, kind: "step_up", next: spent.returnPath ?? "/" };
}
