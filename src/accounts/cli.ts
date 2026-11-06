import { checkEmail } from "./emails.js";
import type { AuthContext } from "./flows/context.js";
import { digestPassword } from "./passwordDigest.js";
import { checkPassword } from "./passwordRule.js";

export interface AccountIo {
    isTty: boolean;
    askHidden(prompt: string): Promise<string>;
    print(line: string): void;
}

interface Login {
    email: string;
    emailKey: string;
    passwordDigest: string;
}

/** Prints a line and gives back an exit code. */
function printed(io: AccountIo, line: string, code: number): number {
    io.print(line);
    return code;
}

/** Reads the email and a password typed twice at a hidden prompt, giving the refusal line when either won't do. */
async function readLogin(io: AccountIo, rawEmail: string): Promise<Login | string> {
    const email = checkEmail(rawEmail);
    if (!email.ok) return "email: not a valid address";
    if (!io.isTty) return "account: needs a terminal for the password";
    const password = await io.askHidden("Password: ");
    if ((await io.askHidden("Password again: ")) !== password) return "password: the two entries differ";
    const problem = checkPassword(password);
    if (problem !== null) return `password: ${problem}`;
    return { email: email.email, emailKey: email.emailKey, passwordDigest: await digestPassword(password) };
}

/** Gives user 1 an email, the admin mark and a password, refusing once user 1 has an email. */
async function init(ctx: AuthContext, login: Login, io: AccountIo): Promise<number> {
    if (!(await ctx.stores.accounts.initOwner(login, ctx.now()))) return printed(io, "account init: user 1 already has an email", 1);
    return printed(io, `account ${login.email}: ready`, 0);
}

/** Sets a new password for an admin found by email, enabling password sign-in and ending every sign-in. */
async function reset(ctx: AuthContext, login: Login, io: AccountIo): Promise<number> {
    const account = await ctx.stores.accounts.byEmailKey(login.emailKey);
    if (account === null || !account.isAdmin) return printed(io, "account reset: no admin with that email", 1);
    const now = ctx.now();
    await ctx.stores.methods.setPassword(account.id, login.passwordDigest, now);
    await ctx.stores.sessions.endAllFor(account.id, now);
    await ctx.stores.accounts.recordEvent({ userId: account.id, at: now, address: null, event: "password_reset", method: "password" });
    return printed(io, `account ${login.email}: password reset`, 0);
}

/** Runs `account init <email>` or `account reset <email>`, returning the exit code; the password never appears in any line. */
export async function accountCommand(ctx: AuthContext, [action, email]: string[], io: AccountIo): Promise<number> {
    const run = action === "init" ? init : action === "reset" ? reset : null;
    if (run === null || email === undefined) return printed(io, "usage: myjobbot account <init|reset> <email>", 2);
    const login = await readLogin(io, email);
    return typeof login === "string" ? printed(io, login, 1) : run(ctx, login, io);
}
