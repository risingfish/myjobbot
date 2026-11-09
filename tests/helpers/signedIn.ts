import { digestPassword } from "../../src/accounts/passwordDigest.js";
import { tokenDigest } from "../../src/accounts/tokens.js";
import { OWNER_ID } from "../../src/db/owner.js";
import { authContext } from "./authContext.js";

export const PASSWORD = "Abcdefgh1!";

export async function signedInOwner() {
    const context = authContext();
    const { ctx } = context;
    await ctx.stores.accounts.initOwner({ email: "owner@example.com", emailKey: "owner@example.com", passwordDigest: await digestPassword(PASSWORD) }, ctx.now());
    const now = ctx.now();
    await ctx.stores.sessions.create({ idDigest: tokenDigest("this"), userId: OWNER_ID, csrfDigest: "c", createdAt: now, lastUsedAt: now, verifiedAt: now, address: "direct", device: { ip: null, os: null, location: null } });
    await ctx.stores.sessions.create({ idDigest: tokenDigest("other"), userId: OWNER_ID, csrfDigest: "c", createdAt: now, lastUsedAt: now, verifiedAt: now, address: "direct", device: { ip: null, os: null, location: null } });
    const session = await ctx.stores.sessions.find(tokenDigest("this"), now);
    const account = await ctx.stores.accounts.account(OWNER_ID);
    if (session === null || account === null) throw new Error("not signed in");
    return { ...context, actor: { account, session, address: "direct" } };
}
