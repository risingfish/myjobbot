import { expect, test } from "vitest";
import { confirmIdentity } from "../src/accounts/flows/confirmIdentity.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { needsStepUp } from "../src/accounts/stepUp.js";
import { PASSWORD, signedInOwner } from "./helpers/signedIn.js";

test("a sensitive change needs identity proved again once the last proof is over 10 minutes old", () => {
    const session = { verifiedAt: "2026-11-06T10:00:00.000Z" };
    expect(needsStepUp(session, "2026-11-06T10:10:00.000Z")).toBe(false);
    expect(needsStepUp(session, "2026-11-06T10:10:00.001Z")).toBe(true);
});

test("confirming with the right password renews the sign-in's proof of identity", async () => {
    const { ctx, actor, clock } = await signedInOwner();
    clock.advance(20 * 60 * 1000);
    expect(await confirmIdentity(ctx, actor, { method: "password", password: PASSWORD })).toEqual({ ok: true });
    expect((await ctx.stores.sessions.find(actor.session.idDigest, ctx.now()))?.verifiedAt).toBe(ctx.now());
});

test("confirming with a wrong password is refused, recorded, and counts toward the sign-in limit", async () => {
    const { ctx, actor, auth } = await signedInOwner();
    for (let tries = 0; tries < 5; tries += 1) expect(await confirmIdentity(ctx, actor, { method: "password", password: "wrong" })).toEqual({ ok: false, message: MESSAGES.signin_failed });
    expect(await confirmIdentity(ctx, actor, { method: "password", password: PASSWORD })).toEqual({ ok: false, message: MESSAGES.signin_failed });
    expect(auth.events.filter((event) => event.event === "signin_failed")).toHaveLength(6);
    expect((await ctx.stores.sessions.find(actor.session.idDigest, ctx.now()))?.verifiedAt).toBe(actor.session.verifiedAt);
});
