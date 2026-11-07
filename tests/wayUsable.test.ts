import { expect, test } from "vitest";
import { wayUsable } from "../src/accounts/ways/usable.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { signedInOwner } from "./helpers/signedIn.js";

test("a way is usable only when switched on and set up, and an email link only while mail is set up", async () => {
    const { ctx } = await signedInOwner();
    expect(await wayUsable(ctx, OWNER_ID, "authenticator")).toBe(false);
    await ctx.stores.methods.setEnabled(OWNER_ID, { kind: "email_link", enabled: true, mailOn: true }, ctx.now());
    expect(await wayUsable(ctx, OWNER_ID, "email_link")).toBe(true);
    expect(await wayUsable({ ...ctx, mail: null }, OWNER_ID, "email_link")).toBe(false);
});
