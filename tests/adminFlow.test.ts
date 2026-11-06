import { expect, test } from "vitest";
import { makeAccountCode, setAdmin } from "../src/accounts/flows/admin.js";
import { createAccount } from "../src/accounts/flows/createAccount.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { authContext } from "./helpers/authContext.js";

async function ownerAndAda() {
    const context = authContext();
    const { ctx } = context;
    await ctx.stores.accounts.initOwner({ email: "owner@example.com", emailKey: "owner@example.com", passwordDigest: "d" }, ctx.now());
    const owner = await ctx.stores.accounts.account(OWNER_ID);
    if (owner === null) throw new Error("no owner");
    const made = await makeAccountCode(ctx, owner);
    if (!made.ok) throw new Error("refused");
    const ada = await createAccount(ctx, { email: "ada@example.com", name: "Ada", password: "Abcdefgh1!", code: made.code, address: "direct", heldDigest: null });
    if (!ada.ok) throw new Error(ada.message);
    return { ...context, owner, adaId: ada.userId, adaSession: tokenDigest(ada.cookies.session) };
}

test("an account without the admin mark can't make codes or change admin marks", async () => {
    const { ctx, adaId } = await ownerAndAda();
    const ada = await ctx.stores.accounts.account(adaId);
    if (ada === null) throw new Error("no ada");
    expect(await makeAccountCode(ctx, ada)).toEqual({ ok: false, message: MESSAGES.not_admin });
    expect(await setAdmin(ctx, { account: ada, session: { idDigest: "s", userId: adaId, csrfDigest: "c", createdAt: "", lastUsedAt: "", verifiedAt: "", endedAt: null, address: "direct", device: { ip: null, os: null, location: null } }, address: "direct" }, { userId: OWNER_ID, admin: false })).toEqual({ ok: false, message: MESSAGES.not_admin });
});

test("an admin grants and removes another account's mark, ending that account's sign-ins and recording each change", async () => {
    const { ctx, owner, adaId, adaSession, auth } = await ownerAndAda();
    expect(await setAdmin(ctx, { account: owner, session: { idDigest: "owner-session", userId: OWNER_ID, csrfDigest: "c", createdAt: "", lastUsedAt: "", verifiedAt: "", endedAt: null, address: "direct", device: { ip: null, os: null, location: null } }, address: "direct" }, { userId: adaId, admin: true })).toEqual({ ok: true, cookies: null });
    expect(await ctx.stores.sessions.find(adaSession, ctx.now())).toBeNull();
    expect(await ctx.stores.accounts.isAdmin(adaId)).toBe(true);
    expect((await setAdmin(ctx, { account: owner, session: { idDigest: "owner-session", userId: OWNER_ID, csrfDigest: "c", createdAt: "", lastUsedAt: "", verifiedAt: "", endedAt: null, address: "direct", device: { ip: null, os: null, location: null } }, address: "direct" }, { userId: adaId, admin: false })).ok).toBe(true);
    expect(auth.events.filter((event) => event.userId === adaId).map((event) => event.event)).toEqual(["signed_in", "admin_granted", "admin_removed"]);
});

test("an admin can remove their own mark while another admin remains, getting a new sign-in, but never the last admin's", async () => {
    const { ctx, owner, adaId } = await ownerAndAda();
    const actor = { account: owner, session: { idDigest: "owner-session", userId: OWNER_ID, csrfDigest: "c", createdAt: "", lastUsedAt: "", verifiedAt: "", endedAt: null, address: "direct", device: { ip: null, os: null, location: null } }, address: "direct" };
    expect(await setAdmin(ctx, actor, { userId: OWNER_ID, admin: false })).toEqual({ ok: false, message: MESSAGES.last_admin });
    await setAdmin(ctx, actor, { userId: adaId, admin: true });
    const own = await setAdmin(ctx, actor, { userId: OWNER_ID, admin: false });
    if (!own.ok || own.cookies === null) throw new Error("no new sign-in");
    expect(await ctx.stores.sessions.find(tokenDigest(own.cookies.session), ctx.now())).toMatchObject({ userId: OWNER_ID });
    expect(await ctx.stores.accounts.isAdmin(OWNER_ID)).toBe(false);
});
