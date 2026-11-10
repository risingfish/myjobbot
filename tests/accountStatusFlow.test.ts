import { expect, test } from "vitest";
import { deactivate, reactivate } from "../src/accounts/flows/accountStatus.js";
import { disconnect } from "../src/gmail/connection.js";
import { noticeFor } from "../src/accounts/events.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { OWNER_ID } from "../src/db/owner.js";
import { MemoryAlertStore } from "./helpers/memoryAlertStore.js";
import { MemoryGmailStore } from "./helpers/memoryGmailStore.js";
import { signedInOwner } from "./helpers/signedIn.js";

function gmailOff(mailbox: Awaited<ReturnType<typeof connectedMailbox>>): () => Promise<void> {
    return () => disconnect(mailbox);
}

async function connectedMailbox() {
    const mailbox = { gmail: new MemoryGmailStore(), alerts: new MemoryAlertStore() };
    await mailbox.gmail.connected({ email: "me@gmail.com", sealedPassword: "sealed" }, "2026-11-06T09:00:00.000Z");
    await mailbox.alerts.recordRead({ uidValidity: 1, lastUid: 9, emails: 2, jobs: 3, notUnderstood: 0 }, "2026-11-06T09:00:00.000Z");
    return mailbox;
}

test("deactivating sets the date, removes the account's Gmail connection and alert progress, records the event and mails a notice", async () => {
    const { ctx, actor, auth, mailer } = await signedInOwner();
    const mailbox = await connectedMailbox();
    expect(await deactivate(ctx, actor, gmailOff(mailbox))).toEqual({ ok: true });
    expect((await ctx.stores.accounts.account(OWNER_ID))?.deactivatedAt).toBe(ctx.now());
    expect([(await mailbox.gmail.connection())?.email ?? null, await mailbox.alerts.state()]).toEqual([null, null]);
    expect(auth.events.map((event) => event.event)).toEqual(["account_deactivated"]);
    expect(mailer.sent.map((mail) => mail.subject)).toEqual(["myjobbot: security notice"]);
});

test("deactivating again keeps the first date and records nothing more", async () => {
    const { ctx, actor, auth, clock } = await signedInOwner();
    await deactivate(ctx, actor, gmailOff(await connectedMailbox()));
    const first = ctx.now();
    clock.advance(60_000);
    expect(await deactivate(ctx, actor, gmailOff(await connectedMailbox()))).toEqual({ ok: true });
    expect((await ctx.stores.accounts.account(OWNER_ID))?.deactivatedAt).toBe(first);
    expect(auth.events).toHaveLength(1);
});

test("reactivating clears the date and records it; it is refused while a deletion is pending", async () => {
    const { ctx, actor, auth } = await signedInOwner();
    await deactivate(ctx, actor, gmailOff(await connectedMailbox()));
    expect(await reactivate(ctx, actor)).toEqual({ ok: true });
    expect((await ctx.stores.accounts.account(OWNER_ID))?.deactivatedAt).toBeNull();
    expect(auth.events.map((event) => event.event)).toEqual(["account_deactivated", "account_reactivated"]);
    await ctx.stores.accounts.setStatus(OWNER_ID, { deactivatedAt: ctx.now(), deleteAfter: "2026-12-06T10:00:00.000Z" });
    expect(await reactivate(ctx, actor)).toEqual({ ok: false, message: MESSAGES.deletion_pending });
});

test("both work without mail, and both events are mailed as notices with their own wording", async () => {
    const { ctx, actor } = await signedInOwner();
    const quiet = { ...ctx, mail: null };
    expect([await deactivate(quiet, actor, gmailOff(await connectedMailbox())), await reactivate(quiet, actor)]).toEqual([{ ok: true }, { ok: true }]);
    expect([noticeFor("account_deactivated"), noticeFor("account_reactivated")]).toEqual(["Account deactivated", "Account reactivated"]);
});
