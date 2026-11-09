import { expect, test } from "vitest";
import { adminChangeEmail } from "../src/accounts/flows/admin.js";
import { requestPasswordReset, spendEmailLink } from "../src/accounts/flows/emailLinks.js";
import { signInWithPassword } from "./helpers/signInWays.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { linkFrom } from "./helpers/linkFrom.js";
import { signedInOwner } from "./helpers/signedIn.js";

const SPEND = { address: "direct", heldDigest: null, sessionDigest: null };

test("asking for a password reset answers the same for every email, or that mail isn't set up for every email", async () => {
    const { ctx, mailer } = await signedInOwner();
    expect([await requestPasswordReset(ctx, { email: "owner@example.com", address: "direct" }), await requestPasswordReset(ctx, { email: "nobody@example.com", address: "direct" })]).toEqual([
        { ok: true, message: MESSAGES.link_sent },
        { ok: true, message: MESSAGES.link_sent },
    ]);
    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([["owner@example.com", "myjobbot: reset your password"]]);
    expect(await requestPasswordReset({ ...ctx, mail: null }, { email: "nobody@example.com", address: "direct" })).toEqual({ ok: false, message: MESSAGES.mail_off });
    expect(await requestPasswordReset(ctx, { email: "", address: "direct" })).toEqual({ ok: false, message: MESSAGES.email_invalid });
});

test("a reset link checks the new password first, then sets it, ends every sign-in, signs no one in, and works once", async () => {
    const { ctx, mailer, auth } = await signedInOwner();
    await requestPasswordReset(ctx, { email: "owner@example.com", address: "direct" });
    const token = linkFrom(mailer, "reset");
    expect(await spendEmailLink(ctx, { ...SPEND, token, purpose: "reset", password: "short" })).toEqual({ ok: false, message: MESSAGES.password_rule });
    expect(await spendEmailLink(ctx, { ...SPEND, token, purpose: "reset", password: "Newpassword1!" })).toEqual({ ok: true, kind: "reset" });
    expect([await ctx.stores.sessions.find(tokenDigest("this"), ctx.now()), await ctx.stores.sessions.find(tokenDigest("other"), ctx.now())]).toEqual([null, null]);
    expect(auth.tables.sessions.filter((session) => session.endedAt === null)).toEqual([]);
    expect(auth.events.at(-1)?.event).toBe("password_reset");
    expect((await signInWithPassword(ctx, { email: "owner@example.com", password: "Newpassword1!", address: "direct", heldDigest: null })).ok).toBe(true);
    expect(await spendEmailLink(ctx, { ...SPEND, token, purpose: "reset", password: "Another1!pass" })).toEqual({ ok: false, message: MESSAGES.link_expired });
});

test("an admin changes another account's email at once, telling the old address, keeping its sign-ins and recording it", async () => {
    const { ctx, actor, mailer, auth } = await signedInOwner();
    auth.tables.users.push({ id: 2, name: "Ada", createdAt: ctx.now(), email: "ada@old.example", emailKey: "ada@old.example", isAdmin: false, deactivatedAt: null, deleteAfter: null });
    await ctx.stores.sessions.create({ idDigest: "ada-session", userId: 2, csrfDigest: "c", createdAt: ctx.now(), lastUsedAt: ctx.now(), verifiedAt: ctx.now(), address: "direct", device: { ip: null, os: null, location: null } });
    expect(await adminChangeEmail(ctx, actor, { userId: 2, email: "owner@example.com" })).toEqual({ ok: false, message: MESSAGES.email_taken });
    expect(await adminChangeEmail(ctx, actor, { userId: 2, email: "Ada@New.example" })).toEqual({ ok: true });
    expect((await ctx.stores.accounts.account(2))?.email).toBe("Ada@New.example");
    expect(mailer.sent.at(-1)).toMatchObject({ to: "ada@old.example", subject: "myjobbot: your email was changed" });
    expect(await ctx.stores.sessions.find("ada-session", ctx.now())).not.toBeNull();
    expect(auth.events.at(-1)).toMatchObject({ userId: 2, event: "admin_email_change" });
});
