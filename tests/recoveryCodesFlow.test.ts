import { expect, test } from "vitest";
import { confirmAuthenticator, removeAuthenticator, startAuthenticatorSetup } from "../src/accounts/flows/authenticator.js";
import { confirmIdentity } from "../src/accounts/flows/confirmIdentity.js";
import { makeRecoveryCodes, signInWithRecoveryCode } from "../src/accounts/flows/recoveryCodes.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { appCode } from "./helpers/appCode.js";
import { signedInOwner } from "./helpers/signedIn.js";

const SIGN_IN = { email: "owner@example.com", address: "direct", heldDigest: null };

async function withCodes() {
    const context = await signedInOwner();
    const started = await startAuthenticatorSetup(context.ctx, context.actor);
    if (!started.ok) throw new Error(started.message);
    const confirmed = await confirmAuthenticator(context.ctx, context.actor, appCode(started.secret, context.ctx.now()));
    if (!confirmed.ok || confirmed.recoveryCodes === null) throw new Error("no codes");
    return { ...context, secret: started.secret, codes: confirmed.recoveryCodes };
}

test("a recovery code signs in once, is recorded with its notice, and still works after the app is removed", async () => {
    const { ctx, actor, codes, auth, mailer } = await withCodes();
    const [first = "", second = ""] = codes;
    expect((await signInWithRecoveryCode(ctx, { ...SIGN_IN, code: first.toLowerCase().replace("-", " ") })).ok).toBe(true);
    expect(await signInWithRecoveryCode(ctx, { ...SIGN_IN, code: first })).toEqual({ ok: false, message: MESSAGES.signin_failed });
    expect(auth.events.filter((event) => event.event === "recovery_code_used")).toHaveLength(1);
    expect(mailer.sent.map((mail) => mail.text).join("\n")).toContain("A recovery code was used to sign in");
    await removeAuthenticator(ctx, actor);
    expect((await signInWithRecoveryCode(ctx, { ...SIGN_IN, code: second })).ok).toBe(true);
    expect(await ctx.stores.tokens.recoveryCodesLeft(OWNER_ID)).toBe(8);
});

test("a new set replaces the old one, and confirming it's you accepts an app code or a recovery code", async () => {
    const { ctx, actor, codes, secret, clock } = await withCodes();
    const made = await makeRecoveryCodes(ctx, actor);
    expect(made.codes).toHaveLength(10);
    expect(await signInWithRecoveryCode(ctx, { ...SIGN_IN, code: codes[0] ?? "" })).toEqual({ ok: false, message: MESSAGES.signin_failed });
    clock.advance(60 * 1000);
    expect(await confirmIdentity(ctx, actor, { method: "authenticator", code: appCode(secret, ctx.now()) })).toEqual({ ok: true });
    expect(await confirmIdentity(ctx, actor, { method: "recovery_code", code: made.codes[0] ?? "" })).toEqual({ ok: true });
    expect(await confirmIdentity(ctx, actor, { method: "recovery_code", code: made.codes[0] ?? "" })).toEqual({ ok: false, message: MESSAGES.signin_failed });
});
