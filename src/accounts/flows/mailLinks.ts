import type { Account } from "../../db/accountStore.js";
import type { Device } from "../../db/sessionStore.js";
import type { NewEmailToken } from "../../db/emailLinkStore.js";
import type { MailContent } from "../../mail/messages.js";
import { checkEmail } from "../emails.js";
import { attemptKey, limitFor, windowStart } from "../limits.js";
import { MESSAGES } from "../messages.js";
import { newToken, tokenDigest } from "../tokens.js";
import type { AuthContext } from "./context.js";
import { mailTo } from "./mail.js";
import type { SessionCookies } from "./sessions.js";

export type Answer = { ok: true; message?: string } | { ok: false; message: string };

export const MAIL_OFF: Answer = { ok: false, message: MESSAGES.mail_off };

/** Counts a mail request against the email's limit, saying whether this one may still send. */
export async function mayMail(ctx: AuthContext, emailKey: string): Promise<boolean> {
    const limit = limitFor("mailEmail");
    const key = attemptKey(limit, emailKey);
    const allowed = (await ctx.stores.attempts.countAttempts(key, windowStart(limit, ctx.now()))) < limit.max;
    await ctx.stores.attempts.recordAttempt(key, ctx.now());
    return allowed;
}

/** Makes a one-time link for an account and mails it, built from the app's address, to the given address or the account's own. */
export async function mailLink(ctx: AuthContext, account: Account, link: { token: Omit<NewEmailToken, "digest">; to?: string; build: (name: string, url: string) => MailContent }): Promise<void> {
    const value = newToken(ctx.random);
    await ctx.stores.emailLinks.make(account.id, { ...link.token, digest: tokenDigest(value) }, ctx.now());
    const to = link.to ?? account.email;
    if (to) mailTo(ctx, to, (baseUrl) => link.build(account.name, `${baseUrl}/link#p=${link.token.purpose}&t=${value}`));
}

/** Answers a link request keyed by a typed email: mail off or a bad email is said plainly; otherwise every email gets the same answer, and the link goes out only to an account, within the mail limit. */
export async function emailKeyedRequest(ctx: AuthContext, rawEmail: string, send: (account: Account) => Promise<void>): Promise<Answer> {
    if (ctx.mail === null) return MAIL_OFF;
    const email = checkEmail(rawEmail);
    if (!email.ok) return email;
    const account = (await mayMail(ctx, email.emailKey)) ? await ctx.stores.accounts.byEmailKey(email.emailKey) : null;
    if (account !== null) await send(account);
    return { ok: true, message: MESSAGES.link_sent };
}

export interface LinkSpend {
    token: string;
    password?: string;
    sessionDigest: string | null;
    address: string;
    heldDigest: string | null;
    device?: Device;
}

export type SpendAnswer = { ok: true; kind: "signin"; cookies: SessionCookies } | { ok: true; kind: "reset" } | { ok: true; kind: "email_change" } | { ok: true; kind: "step_up"; next: string } | { ok: false; message: string };

export const EXPIRED: SpendAnswer = { ok: false, message: MESSAGES.link_expired };
