import type { Account } from "../../db/accountStore.js";
import type { LinkPurpose, NewEmailToken } from "../../db/tokenStore.js";
import { confirmItsYou, confirmNewEmail, passwordReset, signInLink, testMail, type MailContent } from "../../mail/messages.js";
import { checkEmail, normalizeEmail } from "../emails.js";
import { attemptKey, limitFor, windowStart } from "../limits.js";
import { MESSAGES } from "../messages.js";
import { usable } from "../methods.js";
import { safeReturnPath } from "../returnPath.js";
import { newToken, tokenDigest } from "../tokens.js";
import type { Actor, AuthContext } from "./context.js";
import { spendEmailChange, spendReset, spendSignIn, spendStepUp, type LinkSpend, type SpendAnswer } from "./linkSpends.js";
import { mailTo } from "./mail.js";

type Answer = { ok: true; message?: string } | { ok: false; message: string };

const MAIL_OFF: Answer = { ok: false, message: MESSAGES.mail_off };

/** Counts a mail request against the email's limit, saying whether this one may still send. */
async function mayMail(ctx: AuthContext, emailKey: string): Promise<boolean> {
    const limit = limitFor("mailEmail");
    const key = attemptKey(limit, emailKey);
    const allowed = (await ctx.stores.sessions.countAttempts(key, windowStart(limit, ctx.now()))) < limit.max;
    await ctx.stores.sessions.recordAttempt(key, ctx.now());
    return allowed;
}

/** Makes a one-time link for an account and mails it, built from the app's address, to the given address or the account's own. */
async function mailLink(ctx: AuthContext, account: Account, link: { token: Omit<NewEmailToken, "digest">; to?: string; build: (name: string, url: string) => MailContent }): Promise<void> {
    const value = newToken(ctx.random);
    await ctx.stores.tokens.makeEmailToken(account.id, { ...link.token, digest: tokenDigest(value) }, ctx.now());
    const to = link.to ?? account.email;
    if (to) mailTo(ctx, to, (baseUrl) => link.build(account.name, `${baseUrl}/link#p=${link.token.purpose}&t=${value}`));
}

/** Answers a link request keyed by a typed email: mail off or a bad email is said plainly; otherwise every email gets the same answer, and the link goes out only to an account, within the mail limit. */
async function emailKeyedRequest(ctx: AuthContext, rawEmail: string, send: (account: Account) => Promise<void>): Promise<Answer> {
    if (ctx.mail === null) return MAIL_OFF;
    const email = checkEmail(rawEmail);
    if (!email.ok) return email;
    const account = (await mayMail(ctx, email.emailKey)) ? await ctx.stores.accounts.byEmailKey(email.emailKey) : null;
    if (account !== null) await send(account);
    return { ok: true, message: MESSAGES.link_sent };
}

/** Mails a sign-in link to an account with email links on. */
export function requestSignInLink(ctx: AuthContext, input: { email: string; address: string }): Promise<Answer> {
    return emailKeyedRequest(ctx, input.email, async (account) => {
        const way = (await ctx.stores.methods.methods(account.id)).find((row) => row.kind === "email_link");
        if (way !== undefined && usable(way, { mailOn: true })) await mailLink(ctx, account, { token: { purpose: "signin" }, build: signInLink });
    });
}

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
