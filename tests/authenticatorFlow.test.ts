import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { confirmAuthenticator, removeAuthenticator, signInWithAuthenticator, startAuthenticatorSetup } from "../src/accounts/flows/authenticator.js";
import { setMethodEnabled } from "../src/accounts/flows/accountChanges.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { appCode } from "./helpers/appCode.js";
import { signedInOwner } from "./helpers/signedIn.js";

const SIGN_IN = { email: "owner@example.com", address: "direct", heldDigest: null };

async function withAppSetUp() {
    const context = await signedInOwner();
    const started = await startAuthenticatorSetup(context.ctx, context.actor);
    if (!started.ok) throw new Error(started.message);
    const confirmed = await confirmAuthenticator(context.ctx, context.actor, appCode(started.secret, context.ctx.now()));
    if (!confirmed.ok) throw new Error(confirmed.message);
    return { ...context, secret: started.secret, codes: confirmed.recoveryCodes };
}

test("setting up an app stores its secret sealed and not yet set up, and shows the QR code and the secret once", async () => {
    const { ctx, actor, auth } = await signedInOwner();
    const started = await startAuthenticatorSetup(ctx, actor);
    if (!started.ok) throw new Error(started.message);
    expect(started.qr).toMatch(/^data:image\/png;base64,/);
    expect(started.secret).toMatch(/^[A-Z2-7]{32}$/);
    const stored = auth.tables.methods.find((row) => row.kind === "authenticator");
    expect([stored?.ready, stored?.totpSecret?.startsWith("v1."), stored?.totpSecret?.includes(started.secret)]).toEqual([false, true, false]);
    expect(await confirmAuthenticator(ctx, actor, "000000")).toEqual({ ok: false, message: MESSAGES.code_wrong });
});

test("a right code sets the app up and, the first time, gives ten recovery codes, recording both", async () => {
    const { ctx, auth, codes } = await withAppSetUp();
    expect(codes).toHaveLength(10);
    expect((await ctx.stores.methods.methods(OWNER_ID))[3]).toEqual({ kind: "authenticator", enabled: true, ready: true });
    expect(auth.events.map((event) => event.event)).toEqual(expect.arrayContaining(["app_added", "recovery_codes_made"]));
    expect(await ctx.stores.tokens.recoveryCodesLeft(OWNER_ID)).toBe(10);
});

test("an app code signs in once per step, and a reused one or a turned-off app is refused like any failure", async () => {
    const { ctx, actor, secret, clock } = await withAppSetUp();
    clock.advance(60 * 1000);
    const code = appCode(secret, ctx.now());
    expect((await signInWithAuthenticator(ctx, { ...SIGN_IN, code })).ok).toBe(true);
    expect(await signInWithAuthenticator(ctx, { ...SIGN_IN, code })).toEqual({ ok: false, message: MESSAGES.signin_failed });
    await setMethodEnabled(ctx, actor, { kind: "authenticator", enabled: false });
    clock.advance(60 * 1000);
    expect(await signInWithAuthenticator(ctx, { ...SIGN_IN, code: appCode(secret, ctx.now()) })).toEqual({ ok: false, message: MESSAGES.signin_failed });
});

test("without a usable secret key setup isn't offered, and a secret the key can no longer open signs no one in", async () => {
    const { ctx, actor, secret, clock } = await withAppSetUp();
    expect(await startAuthenticatorSetup({ ...ctx, secretKey: null }, actor)).toEqual({ ok: false, message: MESSAGES.secret_key_missing });
    clock.advance(60 * 1000);
    expect(await signInWithAuthenticator({ ...ctx, secretKey: randomBytes(32) }, { ...SIGN_IN, code: appCode(secret, ctx.now()) })).toEqual({ ok: false, message: MESSAGES.signin_failed });
});

test("removing the app clears it and is recorded, but never when it is the last usable way", async () => {
    const { ctx, actor, auth } = await withAppSetUp();
    expect(await removeAuthenticator(ctx, actor)).toEqual({ ok: true });
    expect(await ctx.stores.methods.authenticator(OWNER_ID)).toEqual({ sealedSecret: null, enabled: false, ready: false });
    expect(auth.events.at(-1)?.event).toBe("app_removed");
    const again = await withAppSetUp();
    await setMethodEnabled(again.ctx, again.actor, { kind: "password", enabled: false });
    expect(await removeAuthenticator(again.ctx, again.actor)).toEqual({ ok: false, message: MESSAGES.last_way });
});
