import { readdirSync, readFileSync } from "node:fs";
import { beforeEach, expect, test, vi } from "vitest";
import { MESSAGES } from "../src/accounts/messages.js";
import { guarded } from "../web/lib/guard.js";

const request = vi.hoisted(() => ({ referer: null as string | null, signedIn: null as null | { account: { isAdmin: boolean } } }));

vi.mock("../web/lib/env.js", () => ({ loadRepoEnv: () => {} }));
vi.mock("next/headers.js", () => ({ headers: async () => new Headers(request.referer === null ? {} : { referer: request.referer }), cookies: async () => new Map() }));
vi.mock("next/navigation.js", () => ({
    redirect: (to: string) => {
        throw new Error(`redirect ${to}`);
    },
}));
vi.mock("../web/lib/session.js", () => ({ currentSession: async () => request.signedIn }));

beforeEach(() => {
    vi.stubEnv("MYJOBBOT_BASE_URL", "http://localhost:8080");
    vi.stubEnv("MYJOBBOT_HOSTS", undefined);
    request.referer = null;
    request.signedIn = null;
});

const PUBLIC_ACTIONS = new Set(["signInWithPasswordForm"]);

async function redirectsSignedOut(action: unknown): Promise<boolean> {
    if (typeof action !== "function") return false;
    try {
        await (action as () => Promise<unknown>)();
        return false;
    } catch (error) {
        return error instanceof Error && error.message.startsWith("redirect /sign-in");
    }
}

test("signed out, every action a server-action file exports sends the browser to sign in before it runs, except the public ones", async () => {
    const files = readdirSync("web/lib").filter((name) => name.endsWith(".ts") && readFileSync(`web/lib/${name}`, "utf8").startsWith('"use server";'));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
        const module = (await import(`../web/lib/${file}`)) as Record<string, unknown>;
        const checked = Object.entries(module).filter(([name]) => !PUBLIC_ACTIONS.has(name));
        const unguarded: string[] = [];
        for (const [name, action] of checked) if (!(await redirectsSignedOut(action))) unguarded.push(name);
        expect([file, unguarded]).toEqual([file, []]);
    }
});

test("signed out, an action never runs and the browser is sent to sign in, returning only to a page of the UI", async () => {
    const action = vi.fn(async () => "ran");
    const wrapped = guarded(action, {});
    request.referer = "http://localhost:8080/jobs";
    await expect(wrapped()).rejects.toThrow("redirect /sign-in?next=%2Fjobs");
    request.referer = "http://evil.test/jobs";
    await expect(wrapped()).rejects.toThrow("redirect /sign-in");
    request.referer = null;
    await expect(wrapped()).rejects.toThrow(/^redirect \/sign-in$/);
    expect(action).not.toHaveBeenCalled();
    request.signedIn = { account: { isAdmin: false } };
    expect(await wrapped()).toBe("ran");
});

test("an admin action refuses an account without the admin mark and never runs", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    request.signedIn = { account: { isAdmin: false } };
    expect(await guarded(action, { admin: true })()).toEqual({ ok: false, message: MESSAGES.not_admin });
    expect(action).not.toHaveBeenCalled();
    request.signedIn = { account: { isAdmin: true } };
    expect(await guarded(action, { admin: true })()).toEqual({ ok: true });
});
