import { expect, test } from "vitest";
import { saveName, signOutDevice, signOutEverywhereElse } from "../src/accounts/flows/accountChanges.js";
import { changePassword } from "../src/accounts/ways/password.js";
import { recordSecurityEvent } from "../src/accounts/flows/securityEvents.js";
import { signInWithPassword } from "./helpers/signInWays.js";
import { noticeFor } from "../src/accounts/events.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { OWNER_ID } from "../src/db/owner.js";
import { PASSWORD, signedInOwner } from "./helpers/signedIn.js";

test("a name is saved trimmed, and an empty, long or control-character name is refused", async () => {
    const { ctx, actor } = await signedInOwner();
    expect(await saveName(ctx, actor, "  Zac  ")).toEqual({ ok: true });
    expect((await ctx.stores.accounts.account(OWNER_ID))?.name).toBe("Zac");
    for (const name of ["", "x".repeat(101), "Zac\nBcc: y"]) expect(await saveName(ctx, actor, name)).toEqual({ ok: false, message: MESSAGES.name_invalid });
});

test("changing the password needs the current one and a new one meeting the rule, ends every other sign-in and gives this browser a new one", async () => {
    const { ctx, actor, auth, mailer } = await signedInOwner();
    expect(await changePassword(ctx, actor, { current: "wrong", next: "Newpassword1!" })).toEqual({ ok: false, message: MESSAGES.current_password });
    expect(await changePassword(ctx, actor, { current: PASSWORD, next: "short" })).toEqual({ ok: false, message: MESSAGES.password_rule });
    const changed = await changePassword(ctx, actor, { current: PASSWORD, next: "Newpassword1!" });
    if (!changed.ok) throw new Error(changed.message);
    expect([await ctx.stores.sessions.find(tokenDigest("this"), ctx.now()), await ctx.stores.sessions.find(tokenDigest("other"), ctx.now())]).toEqual([null, null]);
    expect((await ctx.stores.sessions.find(tokenDigest(changed.cookies.session), ctx.now()))?.userId).toBe(OWNER_ID);
    expect((await signInWithPassword(ctx, { email: "owner@example.com", password: "Newpassword1!", address: "direct", heldDigest: null })).ok).toBe(true);
    expect(auth.events.map((event) => event.event)).toContain("password_changed");
    expect(mailer.sent.map((mail) => mail.subject)).toEqual(["myjobbot: security notice"]);
});

test("wrong current passwords count toward the sign-in lock, so a held session can't guess the password", async () => {
    const { ctx, actor, auth } = await signedInOwner();
    for (let tries = 0; tries < 5; tries += 1) await changePassword(ctx, actor, { current: "wrong", next: "Newpassword1!" });
    expect(await changePassword(ctx, actor, { current: PASSWORD, next: "Newpassword1!" })).toEqual({ ok: false, message: MESSAGES.current_password });
    expect(auth.events.map((event) => event.event)).toContain("locked");
    expect((await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "direct", heldDigest: null })).ok).toBe(false);
});

test("signing out everywhere else ends the other sign-ins, keeps this one, and is recorded", async () => {
    const { ctx, actor, auth } = await signedInOwner();
    await signOutEverywhereElse(ctx, actor);
    expect([await ctx.stores.sessions.find(tokenDigest("this"), ctx.now()), await ctx.stores.sessions.find(tokenDigest("other"), ctx.now())].map((row) => row?.idDigest ?? null)).toEqual([tokenDigest("this"), null]);
    expect(auth.events.map((event) => event.event)).toEqual(["signed_out_elsewhere"]);
});

test("every security event is stored, and those that need one queue a notice to the account, a sign-in lock included", async () => {
    const { ctx, mailer } = await signedInOwner();
    await recordSecurityEvent(ctx, { userId: OWNER_ID, at: ctx.now(), address: "direct", event: "signed_in", method: "password" });
    expect(mailer.sent).toEqual([]);
    for (let tries = 0; tries < 5; tries += 1) await signInWithPassword(ctx, { email: "owner@example.com", password: "wrong", address: "direct", heldDigest: null });
    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([["owner@example.com", "myjobbot: security notice"]]);
    expect(mailer.sent[0]?.text).toContain("Sign-in was locked for 15 minutes after too many failed tries");
});

test("every change the spec names gets a notice, and ordinary sign-ins and failures don't", () => {
    const noticed = ["password_changed", "password_reset", "method_enabled", "method_disabled", "key_added", "key_removed", "app_added", "app_removed", "recovery_codes_made", "recovery_code_used", "admin_granted", "admin_removed", "locked"] as const;
    for (const event of noticed) expect(noticeFor(event)).not.toBeNull();
    for (const event of ["signed_in", "signin_failed", "code_made"] as const) expect(noticeFor(event)).toBeNull();
});

test("one other device can be signed out by its reference, never this browser's own, and an ended one is gone", async () => {
    const { ctx, actor, auth } = await signedInOwner();
    const other = tokenDigest("other");
    expect(await signOutDevice(ctx, actor, actor.session.idDigest.slice(0, 16))).toEqual({ ok: false, message: MESSAGES.device_gone });
    expect(await signOutDevice(ctx, actor, other.slice(0, 4))).toEqual({ ok: false, message: MESSAGES.device_gone });
    expect(await signOutDevice(ctx, actor, other.slice(0, 16))).toEqual({ ok: true });
    expect(await ctx.stores.sessions.find(other, ctx.now())).toBeNull();
    expect(await signOutDevice(ctx, actor, other.slice(0, 16))).toEqual({ ok: false, message: MESSAGES.device_gone });
    expect(auth.events.map((event) => event.event)).toEqual(["device_signed_out"]);
});
