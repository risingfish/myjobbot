import { beforeEach, expect, test, vi } from "vitest";
import { MESSAGES } from "../src/accounts/messages.js";
import { signedInAction } from "../web/lib/accountAction.js";

const state = vi.hoisted(() => ({ now: null as unknown }));

vi.mock("../web/lib/actor.js", () => ({ actorNow: async () => state.now }));
vi.mock("../web/lib/authDeps.js", () => ({ authContext: async () => "ctx" }));

beforeEach(() => {
    state.now = null;
});

test("an account action answers signed out for input it can't read or when no one is signed in, and otherwise runs for the actor", async () => {
    const run = vi.fn(async (signedIn: unknown, input: string) => ({ ok: true as const, signedIn, input }));
    const action = signedInAction((value: unknown) => (typeof value === "string" ? value : null), run);
    state.now = { actor: "actor", settings: "settings" };
    expect(await action(5)).toEqual({ ok: false, message: MESSAGES.signed_out });
    state.now = null;
    expect(await action("x")).toEqual({ ok: false, message: MESSAGES.signed_out });
    expect(run).not.toHaveBeenCalled();
    state.now = { actor: "actor", settings: "settings" };
    expect(await action("x")).toEqual({ ok: true, signedIn: { ctx: "ctx", actor: "actor", settings: "settings" }, input: "x" });
});
