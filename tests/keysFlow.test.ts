import { beforeEach, expect, test, vi } from "vitest";
import { finishKeyRegistration, removeKey, startKeyRegistration, startKeySignIn } from "../src/accounts/ways/hardwareKey.js";
import { finishKeySignIn } from "./helpers/signInWays.js";
import { setMethodEnabled } from "../src/accounts/flows/accountChanges.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { OWNER_ID } from "../src/db/owner.js";
import { fakeWebAuthn } from "./helpers/fakeWebAuthn.js";
import { signedInOwner } from "./helpers/signedIn.js";

vi.mock("@simplewebauthn/server", async () => (await import("./helpers/fakeWebAuthn.js")).fakeServer);

const SIGN_IN = { email: "owner@example.com", address: "direct", heldDigest: null };

beforeEach(() => {
    fakeWebAuthn.registration.verified = true;
    fakeWebAuthn.registration.credential.id = "cred-1";
    fakeWebAuthn.authentication = { verified: true, newCounter: 1 };
});

async function withKey() {
    const context = await signedInOwner();
    const started = await startKeyRegistration(context.ctx, context.actor, "Blue key");
    if (!started.ok) throw new Error(started.message);
    const added = await finishKeyRegistration(context.ctx, context.actor, { name: "Blue key", response: { id: "cred-1", challenge: started.options.challenge } });
    if (!added.ok) throw new Error(added.message);
    return { ...context, recoveryCodes: added.recoveryCodes };
}

async function keySignIn(ctx: Parameters<typeof startKeySignIn>[0], credential = "cred-1") {
    const options = await startKeySignIn(ctx);
    if (!options.ok) throw new Error(options.message);
    return finishKeySignIn(ctx, { ...SIGN_IN, response: { id: credential, challenge: options.options.challenge } });
}

test("registration names this site and its address, needs a key that remembers the site, and leaves out the account's own keys", async () => {
    const { ctx, actor } = await withKey();
    await startKeyRegistration(ctx, actor, "Red key");
    expect(fakeWebAuthn.registrationOptions).toMatchObject({ rpID: "localhost", rpName: "myjobbot", userName: "owner@example.com", attestationType: "none", authenticatorSelection: { residentKey: "required", userVerification: "preferred" }, excludeCredentials: [{ id: "cred-1", transports: ["usb"] }] });
    expect(await startKeyRegistration(ctx, actor, "Blue key")).toEqual({ ok: false, message: MESSAGES.key_name_taken });
});

test("a verified key is added under its name and, the first time, gives ten recovery codes, recorded", async () => {
    const { ctx, recoveryCodes, auth } = await withKey();
    expect(recoveryCodes).toHaveLength(10);
    expect(await ctx.stores.keys.keys(OWNER_ID)).toEqual([{ id: expect.any(Number), name: "Blue key" }]);
    expect(auth.events.map((event) => event.event)).toEqual(expect.arrayContaining(["key_added", "recovery_codes_made"]));
});

test("a key signs in with a fresh challenge, once, and its counter is kept", async () => {
    const { ctx } = await withKey();
    expect((await keySignIn(ctx)).ok).toBe(true);
    expect((await ctx.stores.keys.keyByCredential("cred-1"))?.counter).toBe(1);
    const options = await startKeySignIn(ctx);
    if (!options.ok) throw new Error(options.message);
    fakeWebAuthn.authentication.newCounter = 2;
    const response = { id: "cred-1", challenge: options.options.challenge };
    expect((await finishKeySignIn(ctx, { ...SIGN_IN, response })).ok).toBe(true);
    expect(await finishKeySignIn(ctx, { ...SIGN_IN, response })).toEqual({ ok: false, message: MESSAGES.signin_failed });
});

test("a counter that doesn't move on is refused and recorded, and an unknown key, a turned-off way or a failed check are refused", async () => {
    const { ctx, actor, auth } = await withKey();
    fakeWebAuthn.authentication.newCounter = 5;
    await keySignIn(ctx);
    fakeWebAuthn.authentication.newCounter = 5;
    expect(await keySignIn(ctx)).toEqual({ ok: false, message: MESSAGES.signin_failed });
    expect(auth.events.filter((event) => event.event === "key_counter_error")).toHaveLength(1);
    fakeWebAuthn.authentication.newCounter = 9;
    expect(await keySignIn(ctx, "cred-unknown")).toEqual({ ok: false, message: MESSAGES.signin_failed });
    fakeWebAuthn.authentication.verified = false;
    expect(await keySignIn(ctx)).toEqual({ ok: false, message: MESSAGES.signin_failed });
    fakeWebAuthn.authentication.verified = true;
    await setMethodEnabled(ctx, actor, { kind: "hardware_key", enabled: false });
    expect(await keySignIn(ctx)).toEqual({ ok: false, message: MESSAGES.signin_failed });
});

test("removing a key is recorded and turns the way's setup off with the last one, never when it is the last usable way", async () => {
    const { ctx, actor, auth } = await withKey();
    const [blue] = await ctx.stores.keys.keys(OWNER_ID);
    await setMethodEnabled(ctx, actor, { kind: "password", enabled: false });
    expect(await removeKey(ctx, actor, blue?.id ?? 0)).toEqual({ ok: false, message: MESSAGES.last_way });
    await setMethodEnabled(ctx, actor, { kind: "password", enabled: true });
    expect(await removeKey(ctx, actor, blue?.id ?? 0)).toEqual({ ok: true });
    expect(auth.events.at(-1)?.event).toBe("key_removed");
});
