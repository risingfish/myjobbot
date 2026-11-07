import { checkEmail } from "../emails.js";
import { attemptKey, limitFor, windowStart } from "../limits.js";
import { MESSAGES } from "../messages.js";
import { checkName } from "../names.js";
import { tokenDigest } from "../tokens.js";
import { newPasswordDigest } from "../ways/password.js";
import { accountCreated, someoneTried } from "../../mail/messages.js";
import type { NewAccount } from "../../db/accountStore.js";
import type { Device } from "../../db/sessionStore.js";
import type { AuthContext } from "./context.js";
import { mailTo } from "./mail.js";
import { recordSecurityEvent } from "./securityEvents.js";
import { startSession } from "./sessions.js";
import type { SignInAnswer } from "./signIn.js";

export interface AccountForm {
    email: string;
    name: string;
    password: string;
    code: string;
    address: string;
    heldDigest: string | null;
    device?: Device;
}

/** Checks the form's email, name and password, giving the account to make or the first fixed refusal. */
async function checkedForm(form: AccountForm): Promise<NewAccount | string> {
    const email = checkEmail(form.email);
    if (!email.ok) return email.message;
    const name = checkName(form.name);
    if (!name.ok) return name.message;
    const password = await newPasswordDigest(form.password);
    if (!password.ok) return password.message;
    return { email: email.email, emailKey: email.emailKey, name: name.name, passwordDigest: password.digest };
}

/** Counts this attempt against the address's hourly code limit, saying whether the limit was already reached. */
async function overCodeLimit(ctx: AuthContext, address: string): Promise<boolean> {
    const limit = limitFor("codeAddress");
    const key = attemptKey(limit, address);
    const reached = (await ctx.stores.sessions.countAttempts(key, windowStart(limit, ctx.now()))) >= limit.max;
    await ctx.stores.sessions.recordAttempt(key, ctx.now());
    return reached;
}

/** Tells an existing account's owner that someone tried to make an account with their address. */
async function warnOwner(ctx: AuthContext, emailKey: string): Promise<void> {
    const existing = await ctx.stores.accounts.byEmailKey(emailKey);
    if (existing?.email) mailTo(ctx, existing.email, someoneTried);
}

/** Makes an account from the public form with an admin's code, signing it in; a bad code and a taken email get the same refusal. */
export async function createAccount(ctx: AuthContext, form: AccountForm): Promise<SignInAnswer> {
    if (await overCodeLimit(ctx, form.address)) return { ok: false, message: MESSAGES.limited };
    const account = await checkedForm(form);
    if (typeof account === "string") return { ok: false, message: account };
    const result = await ctx.stores.accounts.createAccount(account, tokenDigest(form.code), ctx.now());
    if (result.kind === "taken") await warnOwner(ctx, account.emailKey);
    if (result.kind !== "created") return { ok: false, message: MESSAGES.code_refused };
    const cookies = await startSession(ctx, { userId: result.userId, address: form.address, heldDigest: form.heldDigest, device: form.device });
    await recordSecurityEvent(ctx, { userId: result.userId, at: ctx.now(), address: form.address, event: "signed_in", method: "password" });
    mailTo(ctx, account.email, (baseUrl) => accountCreated(account.name, baseUrl));
    return { ok: true, userId: result.userId, cookies };
}
