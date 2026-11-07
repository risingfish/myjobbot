import { expect, test } from "vitest";
import { setMethodEnabled } from "../src/accounts/flows/accountChanges.js";
import { requestEmailChange, sendTestEmail, spendEmailLink } from "../src/accounts/flows/emailLinks.js";
import { requestSignInLink } from "../src/accounts/ways/emailLink.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { linkFrom } from "./helpers/linkFrom.js";
import { signedInOwner } from "./helpers/signedIn.js";

const SPEND = { address: "direct", heldDigest: null, sessionDigest: null };

async function withLinksOn() {
    const context = await signedInOwner();
    await setMethodEnabled(context.ctx, context.actor, { kind: "email_link", enabled: true });
    return context;
}

test("asking for a sign-in link answers the same for every valid email, refuses one that isn't an email, and mails one only to an account with links on", async () => {
    const { ctx, actor, mailer } = await signedInOwner();
    expect(await requestSignInLink(ctx, { email: "owner@example.com", address: "direct" })).toEqual({ ok: true, message: MESSAGES.link_sent });
    expect(await requestSignInLink(ctx, { email: "nobody@example.com", address: "direct" })).toEqual({ ok: true, message: MESSAGES.link_sent });
    expect([await requestSignInLink(ctx, { email: "", address: "direct" }), await requestSignInLink(ctx, { email: "not an email", address: "direct" })]).toEqual([
        { ok: false, message: MESSAGES.email_invalid },
        { ok: false, message: MESSAGES.email_invalid },
    ]);
    expect(mailer.sent).toEqual([]);
    await setMethodEnabled(ctx, actor, { kind: "email_link", enabled: true });
    await requestSignInLink(ctx, { email: "Owner@Example.com", address: "direct" });
    const links = mailer.sent.filter((mail) => mail.subject === "myjobbot: your sign-in link");
    expect(links.map((mail) => mail.to)).toEqual(["owner@example.com"]);
    expect(links[0]?.text).toContain("expires in 15 minutes");
});

test("at most 3 link requests per email in 15 minutes are mailed, and with mail off every email is told mail isn't set up", async () => {
    const { ctx, mailer } = await withLinksOn();
    for (let tries = 0; tries < 5; tries += 1) await requestSignInLink(ctx, { email: "owner@example.com", address: "direct" });
    expect(mailer.sent.filter((mail) => mail.subject === "myjobbot: your sign-in link")).toHaveLength(3);
    const off = { ...ctx, mail: null };
    expect([await requestSignInLink(off, { email: "owner@example.com", address: "direct" }), await requestSignInLink(off, { email: "nobody@example.com", address: "direct" })]).toEqual([
        { ok: false, message: MESSAGES.mail_off },
        { ok: false, message: MESSAGES.mail_off },
    ]);
});

test("a sign-in link signs in once, recorded as an email link, and a reused or expired one is refused", async () => {
    const { ctx, mailer, auth, clock } = await withLinksOn();
    await requestSignInLink(ctx, { email: "owner@example.com", address: "direct" });
    const token = linkFrom(mailer, "signin");
    const signedIn = await spendEmailLink(ctx, { ...SPEND, token, purpose: "signin" });
    if (!signedIn.ok || signedIn.kind !== "signin") throw new Error("not signed in");
    expect((await ctx.stores.sessions.find(tokenDigest(signedIn.cookies.session), ctx.now()))?.userId).toBe(OWNER_ID);
    expect(auth.events.at(-1)).toMatchObject({ event: "signed_in", method: "email_link" });
    expect(await spendEmailLink(ctx, { ...SPEND, token, purpose: "signin" })).toEqual({ ok: false, message: MESSAGES.link_expired });
    await requestSignInLink(ctx, { email: "owner@example.com", address: "direct" });
    clock.advance(15 * 60 * 1000 + 1);
    expect(await spendEmailLink(ctx, { ...SPEND, token: linkFrom(mailer, "signin"), purpose: "signin" })).toEqual({ ok: false, message: MESSAGES.link_expired });
});

test("the test email goes to the account's address, or says mail isn't set up", async () => {
    const { ctx, actor, mailer } = await signedInOwner();
    expect(await sendTestEmail(ctx, actor)).toEqual({ ok: true });
    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([["owner@example.com", "myjobbot: test email"]]);
    expect(await sendTestEmail({ ...ctx, mail: null }, actor)).toEqual({ ok: false, message: MESSAGES.mail_off });
});

test("with mail off, email links can't be turned on", async () => {
    const { ctx, actor } = await signedInOwner();
    expect(await setMethodEnabled({ ...ctx, mail: null }, actor, { kind: "email_link", enabled: true })).toEqual({ ok: false, message: MESSAGES.mail_off });
    expect((await ctx.stores.methods.methods(OWNER_ID))[1]?.enabled).toBe(false);
});

test("an email change mails a confirm link to a free address only, answering alike for a taken one, and refuses the current address", async () => {
    const { ctx, actor, mailer } = await signedInOwner();
    expect(await requestEmailChange(ctx, actor, "owner@example.com")).toEqual({ ok: false, message: MESSAGES.email_unchanged });
    expect(await requestEmailChange(ctx, actor, "new@example.com")).toEqual({ ok: true, message: MESSAGES.email_change_sent });
    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([["new@example.com", "myjobbot: confirm your new email"]]);
    expect((await ctx.stores.accounts.account(OWNER_ID))?.email).toBe("owner@example.com");
});

test("a confirm link changes the email and tells the old address, unless another account took the address meanwhile", async () => {
    const { ctx, actor, mailer, auth } = await signedInOwner();
    await requestEmailChange(ctx, actor, "new@example.com");
    expect(await spendEmailLink(ctx, { ...SPEND, token: linkFrom(mailer, "email_change"), purpose: "email_change" })).toEqual({ ok: true, kind: "email_change" });
    expect((await ctx.stores.accounts.account(OWNER_ID))?.email).toBe("new@example.com");
    expect(mailer.sent.at(-1)).toMatchObject({ to: "owner@example.com", subject: "myjobbot: your email was changed" });
    expect(auth.events.at(-1)?.event).toBe("email_changed");
    await requestEmailChange(ctx, { ...actor, account: { ...actor.account, email: "new@example.com" } }, "later@example.com");
    auth.tables.users.push({ id: 7, name: "Ada", createdAt: ctx.now(), email: "later@example.com", emailKey: "later@example.com", isAdmin: false });
    expect(await spendEmailLink(ctx, { ...SPEND, token: linkFrom(mailer, "email_change"), purpose: "email_change" })).toEqual({ ok: false, message: MESSAGES.email_taken });
});
