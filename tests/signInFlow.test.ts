import { expect, test } from "vitest";
import { limitFor } from "../src/accounts/limits.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { digestPassword } from "../src/accounts/passwordDigest.js";
import { signOut } from "../src/accounts/flows/signIn.js";
import { signInWithPassword } from "./helpers/signInWays.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { authContext } from "./helpers/authContext.js";

const PASSWORD = "Abcdefgh1!";

async function signedUpContext() {
    const context = authContext();
    await context.ctx.stores.accounts.initOwner({ email: "owner@example.com", emailKey: "owner@example.com", passwordDigest: await digestPassword(PASSWORD) }, context.ctx.now());
    return context;
}

test("the right email and password make a new sign-in, ending the one the browser held, and record it", async () => {
    const { ctx, auth } = await signedUpContext();
    const first = await signInWithPassword(ctx, { email: " Owner@Example.com ", password: PASSWORD, address: "direct", heldDigest: null });
    if (!first.ok) throw new Error("sign-in refused");
    const second = await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "direct", heldDigest: tokenDigest(first.cookies.session) });
    if (!second.ok) throw new Error("sign-in refused");
    const found = await ctx.stores.sessions.find(tokenDigest(second.cookies.session), ctx.now());
    expect(found).toMatchObject({ userId: OWNER_ID, verifiedAt: ctx.now(), csrfDigest: tokenDigest(second.cookies.csrf), address: "direct" });
    expect(await ctx.stores.sessions.find(tokenDigest(first.cookies.session), ctx.now())).toBeNull();
    expect(auth.events.map((event) => [event.event, event.method])).toEqual([["signed_in", "password"], ["signed_in", "password"]]);
});

test("a wrong password, an unknown email and a disabled password all get the same refusal", async () => {
    const { ctx, auth } = await signedUpContext();
    const wrong = await signInWithPassword(ctx, { email: "owner@example.com", password: "Abcdefgh1?", address: "direct", heldDigest: null });
    const unknown = await signInWithPassword(ctx, { email: "nobody@example.com", password: PASSWORD, address: "direct", heldDigest: null });
    for (const method of auth.tables.methods) method.enabled = false;
    const disabled = await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "direct", heldDigest: null });
    expect([wrong, unknown, disabled]).toEqual(Array(3).fill({ ok: false, message: MESSAGES.signin_failed }));
    expect(auth.events.map((event) => [event.userId, event.event])).toEqual([[OWNER_ID, "signin_failed"], [OWNER_ID, "signin_failed"]]);
    expect(auth.tables.sessions).toEqual([]);
});

test("after five failures for one email in 15 minutes even the right password is refused, and the lock is recorded once", async () => {
    const { ctx, auth } = await signedUpContext();
    for (let tries = 0; tries < 6; tries += 1) await signInWithPassword(ctx, { email: "owner@example.com", password: "nope", address: `10.0.0.${tries}`, heldDigest: null });
    expect(await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "10.0.0.9", heldDigest: null })).toEqual({ ok: false, message: MESSAGES.signin_failed });
    expect(auth.events.filter((event) => event.event === "locked")).toHaveLength(1);
});

test("twenty failures from one address in 15 minutes lock that address for every email", async () => {
    const { ctx } = await signedUpContext();
    for (let tries = 0; tries < 20; tries += 1) await signInWithPassword(ctx, { email: `x${tries}@example.com`, password: "nope", address: "direct", heldDigest: null });
    expect((await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "direct", heldDigest: null })).ok).toBe(false);
    expect((await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "10.1.1.1", heldDigest: null })).ok).toBe(true);
});

test("the lock lifts once the failures are 15 minutes old", async () => {
    const { ctx, clock } = await signedUpContext();
    for (let tries = 0; tries < 5; tries += 1) await signInWithPassword(ctx, { email: "owner@example.com", password: "nope", address: "direct", heldDigest: null });
    clock.advance(15 * 60 * 1000 + 1);
    expect((await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "direct", heldDigest: null })).ok).toBe(true);
});

test("the four limits are 5 sign-in failures per email and 20 per address in 15 minutes, 3 emails per address in 15 minutes and 10 codes per address an hour", () => {
    expect([limitFor("signinEmail"), limitFor("signinAddress"), limitFor("mailEmail"), limitFor("codeAddress")]).toEqual([
        { kind: "signin_fail", scope: "email", max: 5, minutes: 15 },
        { kind: "signin_fail", scope: "address", max: 20, minutes: 15 },
        { kind: "mail_request", scope: "email", max: 3, minutes: 15 },
        { kind: "code_attempt", scope: "address", max: 10, minutes: 60 },
    ]);
});

test("signing out ends the sign-in on the server", async () => {
    const { ctx } = await signedUpContext();
    const signedIn = await signInWithPassword(ctx, { email: "owner@example.com", password: PASSWORD, address: "direct", heldDigest: null });
    if (!signedIn.ok) throw new Error("sign-in refused");
    await signOut(ctx, tokenDigest(signedIn.cookies.session));
    expect(await ctx.stores.sessions.find(tokenDigest(signedIn.cookies.session), ctx.now())).toBeNull();
});
