import { expect, test } from "vitest";
import { setMethodEnabled } from "../src/accounts/flows/accountChanges.js";
import { keepsAWay, usable } from "../src/accounts/methods.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { signedInOwner } from "./helpers/signedIn.js";

const PASSWORD_ONLY = [{ kind: "password" as const, enabled: true, ready: true }];

test("a way is usable only when enabled and set up, and an emailed link only while mail is set up", () => {
    expect(usable({ kind: "password", enabled: true, ready: true }, { mailOn: false })).toBe(true);
    expect([usable({ kind: "password", enabled: false, ready: true }, { mailOn: true }), usable({ kind: "authenticator", enabled: true, ready: false }, { mailOn: true })]).toEqual([false, false]);
    expect([usable({ kind: "email_link", enabled: true, ready: true }, { mailOn: true }), usable({ kind: "email_link", enabled: true, ready: true }, { mailOn: false })]).toEqual([true, false]);
});

test("unticking the last usable way is refused, and unticking one of two is allowed", async () => {
    expect(keepsAWay(PASSWORD_ONLY, { kind: "password", enabled: false, mailOn: true })).toBe(false);
    expect(keepsAWay([...PASSWORD_ONLY, { kind: "email_link", enabled: true, ready: true }], { kind: "password", enabled: false, mailOn: true })).toBe(true);
    const { ctx, actor } = await signedInOwner();
    expect(await setMethodEnabled(ctx, actor, { kind: "password", enabled: false })).toEqual({ ok: false, message: MESSAGES.last_way });
});

test("ticking a way that isn't set up switches it on, asks for its setup, and leaves it unusable", async () => {
    const { ctx, actor, auth } = await signedInOwner();
    expect(await setMethodEnabled(ctx, actor, { kind: "authenticator", enabled: true })).toEqual({ ok: true, setup: "authenticator" });
    expect((await ctx.stores.methods.methods(actor.account.id))[3]).toEqual({ kind: "authenticator", enabled: true, ready: false });
    expect(await setMethodEnabled(ctx, actor, { kind: "password", enabled: false })).toEqual({ ok: false, message: MESSAGES.last_way });
    expect(auth.events.map((event) => [event.event, event.method])).toEqual([["method_enabled", "authenticator"]]);
});
