import { expect, test } from "vitest";
import { cancelDeletion, requestDeletion } from "../src/accounts/flows/accountDeletion.js";
import { noticeFor } from "../src/accounts/events.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { OWNER_ID } from "../src/db/owner.js";
import { signedInOwner } from "./helpers/signedIn.js";

async function ownerWithAnotherAdmin() {
    const signedIn = await signedInOwner();
    signedIn.auth.tables.users.push({ id: 2, name: "Ada", createdAt: signedIn.ctx.now(), email: "ada@example.com", emailKey: "ada@example.com", isAdmin: true, deactivatedAt: null, deleteAfter: null });
    let gmailRemoved = 0;
    return { ...signedIn, disconnectGmail: async () => void (gmailRemoved += 1), gmailRemoved: () => gmailRemoved };
}

test("a deletion is refused unless the typed email is the account's, compared as at sign-in", async () => {
    const { ctx, actor, disconnectGmail, auth } = await ownerWithAnotherAdmin();
    expect(await requestDeletion(ctx, actor, disconnectGmail, "someone@example.com")).toEqual({ ok: false, message: MESSAGES.email_mismatch });
    expect((await ctx.stores.accounts.account(OWNER_ID))?.deleteAfter).toBeNull();
    expect(JSON.stringify(auth.events)).not.toContain("someone@example.com");
});

test("the only admin may not ask for deletion", async () => {
    const { ctx, actor } = await signedInOwner();
    expect(await requestDeletion(ctx, actor, async () => {}, "owner@example.com")).toEqual({ ok: false, message: MESSAGES.last_admin_delete });
});

test("a deletion asked for deactivates the account, sets the date 30 days on, removes Gmail, records it and mails a notice", async () => {
    const { ctx, actor, disconnectGmail, gmailRemoved, auth, mailer } = await ownerWithAnotherAdmin();
    expect(await requestDeletion(ctx, actor, disconnectGmail, " Owner@Example.com ")).toEqual({ ok: true });
    expect(await ctx.stores.accounts.account(OWNER_ID)).toMatchObject({ deactivatedAt: ctx.now(), deleteAfter: "2026-12-06T10:00:00.000Z" });
    expect([gmailRemoved(), auth.events.map((event) => event.event), mailer.sent.length]).toEqual([1, ["deletion_requested"], 1]);
});

test("cancelling clears the date and keeps the account deactivated, and both work without mail", async () => {
    const { ctx, actor, disconnectGmail, auth } = await ownerWithAnotherAdmin();
    const quiet = { ...ctx, mail: null };
    await requestDeletion(quiet, actor, disconnectGmail, "owner@example.com");
    expect(await cancelDeletion(quiet, actor)).toEqual({ ok: true });
    expect(await ctx.stores.accounts.account(OWNER_ID)).toMatchObject({ deactivatedAt: ctx.now(), deleteAfter: null });
    expect(auth.events.map((event) => event.event)).toEqual(["deletion_requested", "deletion_cancelled"]);
    expect([noticeFor("deletion_requested"), noticeFor("deletion_cancelled")]).toEqual(["Account deletion requested", "Account deletion cancelled"]);
});
