import type { LinkPurpose } from "../../db/tokenStore.js";
import { confirmItsYou, confirmNewEmail, passwordReset, testMail } from "../../mail/messages.js";
import { checkEmail, normalizeEmail } from "../emails.js";
import { MESSAGES } from "../messages.js";
import { safeReturnPath } from "../returnPath.js";
import { spendSignIn } from "../ways/emailLink.js";
import type { Actor, AuthContext } from "./context.js";
import { spendEmailChange, spendReset, spendStepUp } from "./linkSpends.js";
import { mailTo } from "./mail.js";
import { emailKeyedRequest, MAIL_OFF, mailLink, mayMail, type Answer, type LinkSpend, type SpendAnswer } from "./mailLinks.js";

/** Mails a password reset link to an account. */
export function requestPasswordReset(ctx: AuthContext, input: { email: string; address: string }): Promise<Answer> {
    return emailKeyedRequest(ctx, input.email, (account) => mailLink(ctx, account, { token: { purpose: "reset" }, build: passwordReset }));
}

/** Mails the test email to the signed-in account. */
export async function sendTestEmail(ctx: AuthContext, actor: Actor): Promise<Answer> {
    if (ctx.mail === null || !actor.account.email) return MAIL_OFF;
    if (await mayMail(ctx, normalizeEmail(actor.account.email))) mailTo(ctx, actor.account.email, () => testMail(actor.account.name));
    return { ok: true };
}

/** Mails a link confirming a new email to that address when it is free; a taken one gets the same answer and no mail; nothing changes yet. */
export async function requestEmailChange(ctx: AuthContext, actor: Actor, raw: string): Promise<Answer> {
    if (ctx.mail === null) return MAIL_OFF;
    const email = checkEmail(raw);
    if (!email.ok) return email;
    if (email.emailKey === normalizeEmail(actor.account.email ?? "")) return { ok: false, message: MESSAGES.email_unchanged };
    const free = (await mayMail(ctx, normalizeEmail(actor.account.email ?? ""))) && (await ctx.stores.accounts.byEmailKey(email.emailKey)) === null;
    if (free) await mailLink(ctx, actor.account, { token: { purpose: "email_change", newEmail: email.email }, to: email.email, build: confirmNewEmail });
    return { ok: true, message: MESSAGES.email_change_sent };
}

/** Mails a confirm-it's-you link bound to this sign-in, returning afterwards to a page of the UI. */
export async function requestStepUpLink(ctx: AuthContext, actor: Actor, returnPath: string): Promise<Answer> {
    if (ctx.mail === null) return MAIL_OFF;
    const token = { purpose: "step_up" as const, sessionDigest: actor.session.idDigest, returnPath: safeReturnPath(returnPath) };
    if (await mayMail(ctx, normalizeEmail(actor.account.email ?? ""))) await mailLink(ctx, actor.account, { token, build: confirmItsYou });
    return { ok: true, message: MESSAGES.step_up_sent };
}

const SPENDS: Record<LinkPurpose, (ctx: AuthContext, spend: LinkSpend) => Promise<SpendAnswer>> = { signin: spendSignIn, reset: spendReset, email_change: spendEmailChange, step_up: spendStepUp };

/** Uses an emailed link for its purpose, once. */
export function spendEmailLink(ctx: AuthContext, spend: LinkSpend & { purpose: LinkPurpose }): Promise<SpendAnswer> {
    return SPENDS[spend.purpose](ctx, spend);
}
