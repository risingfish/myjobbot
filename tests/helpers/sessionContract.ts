import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";
const LOGIN = { email: "owner@example.com", emailKey: "owner@example.com", passwordDigest: "argon2id$x" };

function session(idDigest: string, at = NOW) {
    return { idDigest, userId: OWNER_ID, csrfDigest: `csrf-${idDigest}`, createdAt: at, lastUsedAt: at, verifiedAt: at, address: "direct", device: { ip: null, os: null, location: null } };
}

function withStores(makeStores: MakeStores, check: (stores: TestStores) => Promise<void>) {
    return async () => {
        const stores = await makeStores();
        try {
            await stores.accounts.initOwner(LOGIN, NOW);
            await check(stores);
        } finally {
            await stores.close();
        }
    };
}

async function foundUntilExpiredOrEnded({ sessions }: TestStores): Promise<void> {
    await sessions.create(session("a"));
    expect(await sessions.find("a", "2026-12-05T09:00:00.000Z")).toMatchObject({ idDigest: "a", userId: OWNER_ID, csrfDigest: "csrf-a", endedAt: null });
    expect(await sessions.find("a", "2026-12-06T10:00:01.000Z")).toBeNull();
    await sessions.touch("a", "2026-12-01T00:00:00.000Z");
    expect(await sessions.find("a", "2026-12-06T10:00:01.000Z")).toMatchObject({ lastUsedAt: "2026-12-01T00:00:00.000Z" });
    expect(await sessions.find("missing", NOW)).toBeNull();
}

async function endedOneOrAll({ sessions }: TestStores): Promise<void> {
    for (const id of ["a", "b", "c"]) await sessions.create(session(id));
    await sessions.end("a", NOW);
    expect(await sessions.find("a", NOW)).toBeNull();
    await sessions.endAllFor(OWNER_ID, NOW, "b");
    expect([await sessions.find("b", NOW), await sessions.find("c", NOW)].map((row) => row?.idDigest ?? null)).toEqual(["b", null]);
    await sessions.endAllFor(OWNER_ID, NOW);
    expect(await sessions.find("b", NOW)).toBeNull();
}

async function csrfRebound({ sessions }: TestStores): Promise<void> {
    await sessions.create(session("a"));
    await sessions.rebindCsrf("a", "fresh");
    expect((await sessions.find("a", NOW))?.csrfDigest).toBe("fresh");
}

async function oldSessionsPruned({ sessions }: TestStores): Promise<void> {
    await sessions.create(session("ended-long-ago", "2026-09-01T00:00:00.000Z"));
    await sessions.end("ended-long-ago", "2026-09-02T00:00:00.000Z");
    await sessions.create(session("ended-recently", "2026-11-01T00:00:00.000Z"));
    await sessions.end("ended-recently", "2026-11-02T00:00:00.000Z");
    await sessions.create(session("expired-long-ago", "2026-08-01T00:00:00.000Z"));
    await sessions.create(session("live"));
    await sessions.pruneEnded(NOW);
    await sessions.create(session("ended-long-ago"));
    await sessions.create(session("expired-long-ago"));
    await expect(sessions.create(session("ended-recently"))).rejects.toThrow();
    await expect(sessions.create(session("live"))).rejects.toThrow();
    expect(await sessions.find("live", NOW)).not.toBeNull();
}

async function verifiedAgain({ sessions }: TestStores): Promise<void> {
    await sessions.create(session("a"));
    await sessions.setVerified("a", "2026-11-06T10:30:00.000Z");
    expect((await sessions.find("a", NOW))?.verifiedAt).toBe("2026-11-06T10:30:00.000Z");
}

async function activeListed({ sessions }: TestStores): Promise<void> {
    await sessions.create({ ...session("old", "2026-11-01T00:00:00.000Z"), device: { ip: "203.0.113.9", os: "macOS", location: "Seattle, WA, US" } });
    await sessions.create(session("new"));
    await sessions.create(session("ended"));
    await sessions.end("ended", NOW);
    await sessions.create(session("expired", "2026-09-01T00:00:00.000Z"));
    const active = await sessions.activeFor(OWNER_ID, NOW);
    expect(active.map((row) => row.idDigest)).toEqual(["new", "old"]);
    expect(active[1]?.device).toEqual({ ip: "203.0.113.9", os: "macOS", location: "Seattle, WA, US" });
}

export function sessionContract(makeStores: MakeStores): void {
    test("an account's live sign-ins are listed most recently used first, with each one's device", withStores(makeStores, activeListed));
    test("proving identity again moves a sign-in's verified time", withStores(makeStores, verifiedAgain));
    test("a sign-in is found until it is ended or goes 30 days unused, and using it keeps it alive", withStores(makeStores, foundUntilExpiredOrEnded));
    test("one sign-in ends alone, and ending all of an account's sign-ins can spare one", withStores(makeStores, endedOneOrAll));
    test("a sign-in can be tied to a new forgery cookie", withStores(makeStores, csrfRebound));
    test("pruning drops sign-ins that ended or expired long ago and keeps live ones", withStores(makeStores, oldSessionsPruned));
}
