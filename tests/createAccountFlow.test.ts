import { expect, test } from "vitest";
import { makeAccountCode } from "../src/accounts/flows/admin.js";
import { createAccount } from "../src/accounts/flows/createAccount.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { OWNER_ID } from "../src/db/owner.js";
import { authContext } from "./helpers/authContext.js";

const FORM = { email: "Ada@Example.com", name: "Ada Lovelace", password: "Abcdefgh1!", address: "direct", heldDigest: null };

async function withCode() {
    const context = authContext();
    await context.ctx.stores.accounts.initOwner({ email: "owner@example.com", emailKey: "owner@example.com", passwordDigest: "d" }, context.ctx.now());
    const owner = await context.ctx.stores.accounts.account(OWNER_ID);
    if (owner === null) throw new Error("no owner");
    const made = await makeAccountCode(context.ctx, owner);
    if (!made.ok) throw new Error("code refused");
    return { ...context, code: made.code, made };
}

test("an admin's code is 43 base64url characters, kept only as its digest, and expires 7 days on", async () => {
    const { code, made, auth } = await withCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(made.expiresAt).toBe("2026-11-13T10:00:00.000Z");
    expect(auth.tables.codes.map((row) => row.digest)).toEqual([tokenDigest(code)]);
    expect(JSON.stringify(auth.tables)).not.toContain(code);
    expect(auth.events.map((event) => event.event)).toEqual(["code_made"]);
});

test("a valid form makes the account, signs it in with a bound forgery cookie, mails it, and records the sign-in", async () => {
    const { ctx, code, auth, mailer } = await withCode();
    const answer = await createAccount(ctx, { ...FORM, code });
    if (!answer.ok) throw new Error(answer.message);
    const session = await ctx.stores.sessions.find(tokenDigest(answer.cookies.session), ctx.now());
    expect(session).toMatchObject({ userId: answer.userId, csrfDigest: tokenDigest(answer.cookies.csrf) });
    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([["Ada@Example.com", "myjobbot: your account was created"]]);
    expect(auth.events.map((event) => [event.userId, event.event])).toEqual([[OWNER_ID, "code_made"], [answer.userId, "signed_in"]]);
});

test("a bad, spent or expired code and a taken email all get the same refusal, and the taken address's owner is told", async () => {
    const { ctx, code, mailer } = await withCode();
    expect(await createAccount(ctx, { ...FORM, code: "made-up" })).toEqual({ ok: false, message: MESSAGES.code_refused });
    expect(await createAccount(ctx, { ...FORM, email: "owner@example.com", code })).toEqual({ ok: false, message: MESSAGES.code_refused });
    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([["owner@example.com", "myjobbot: someone tried to make an account with your address"]]);
    expect((await createAccount(ctx, { ...FORM, code })).ok).toBe(true);
    expect(await createAccount(ctx, { ...FORM, email: "b@example.com", code })).toEqual({ ok: false, message: MESSAGES.code_refused });
    const fresh = await withCode();
    fresh.clock.advance(7 * 24 * 60 * 60 * 1000 + 1);
    expect(await createAccount(fresh.ctx, { ...FORM, code: fresh.code })).toEqual({ ok: false, message: MESSAGES.code_refused });
});

test("a weak password, a bad email or a bad name is refused with its rule and leaves the code unspent", async () => {
    const { ctx, code } = await withCode();
    expect(await createAccount(ctx, { ...FORM, password: "short", code })).toEqual({ ok: false, message: MESSAGES.password_rule });
    expect(await createAccount(ctx, { ...FORM, email: "nope", code })).toEqual({ ok: false, message: MESSAGES.email_invalid });
    expect(await createAccount(ctx, { ...FORM, name: "Ada\nBcc: x@y.z", code })).toEqual({ ok: false, message: MESSAGES.name_invalid });
    expect((await createAccount(ctx, { ...FORM, code })).ok).toBe(true);
});

test("after 10 code attempts from one address in an hour, every further one is refused as too many", async () => {
    const { ctx, code } = await withCode();
    for (let tries = 0; tries < 10; tries += 1) await createAccount(ctx, { ...FORM, code: `guess-${tries}` });
    expect(await createAccount(ctx, { ...FORM, code })).toEqual({ ok: false, message: MESSAGES.limited });
    expect((await createAccount(ctx, { ...FORM, code, address: "10.0.0.9" })).ok).toBe(true);
});
