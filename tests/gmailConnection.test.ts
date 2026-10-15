import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { check } from "../src/gmail/check.js";
import { connect, disconnect, keyChanged, type GmailDeps } from "../src/gmail/connection.js";
import { GmailError } from "../src/gmail/imapErrors.js";
import { openOrNull, seal } from "../src/gmail/seal.js";
import { fakeImap, type FakeImap, type FakeImapScript } from "./helpers/fakeImap.js";
import { gmailRow } from "./helpers/gmailRows.js";
import { memoryStores } from "./helpers/memoryStore.js";

const KEY = randomBytes(32);
const NOW = new Date("2026-10-15T12:00:00.000Z");
const PASSWORD = "abcd efgh ijkl mnop";

function deps(fake: FakeImap = fakeImap()): GmailDeps {
    return { gmail: memoryStores().gmail, key: KEY, imap: fake.factory };
}

async function connectedDeps(script: FakeImapScript = {}): Promise<{ gmail: GmailDeps; fake: FakeImap }> {
    const fake = fakeImap();
    const gmail = deps(fake);
    await connect(gmail, { email: "me@example.com", appPassword: PASSWORD }, NOW);
    const scripted = fakeImap(script);
    return { gmail: { ...gmail, imap: scripted.factory }, fake: scripted };
}

test("connecting signs in first, then stores the sealed password without spaces", async () => {
    const fake = fakeImap();
    const gmail = deps(fake);
    expect(await connect(gmail, { email: " me@example.com ", appPassword: PASSWORD }, NOW)).toEqual({ ok: true, error: null });
    expect(fake.sessions).toEqual([{ email: "me@example.com", password: "abcdefghijklmnop" }]);
    const row = await gmail.gmail.connection();
    expect([row?.email, row?.status, row?.connected_at]).toEqual(["me@example.com", "connected", NOW.toISOString()]);
    expect(openOrNull(row?.app_password ?? "", "app_password", KEY)).toBe("abcdefghijklmnop");
});

test("a rejected, unreachable or malformed sign-in stores nothing and says why", async () => {
    const cases: Array<[FakeImapScript, { email: string; appPassword: string }, string]> = [
        [{ fail: new GmailError("bad_login") }, { email: "me@example.com", appPassword: PASSWORD }, "Gmail rejected the address or app password."],
        [{ fail: new GmailError("unreachable") }, { email: "me@example.com", appPassword: PASSWORD }, "Gmail couldn't be reached; try again."],
        [{}, { email: "not-an-address", appPassword: PASSWORD }, "Enter your Gmail address."],
        [{}, { email: "me@example.com", appPassword: "   " }, "Enter the app password (up to 64 characters)."],
    ];
    for (const [script, input, error] of cases) {
        const fake = fakeImap(script);
        const gmail = deps(fake);
        expect(await connect(gmail, input, NOW)).toEqual({ ok: false, error });
        expect(await gmail.gmail.connection()).toBeNull();
    }
});

test("a key change is noticed when the saved password no longer opens", () => {
    expect(keyChanged(deps(), gmailRow({ app_password: seal("pw", "app_password", randomBytes(32)) }))).toBe(true);
    expect(keyChanged(deps(), gmailRow({ app_password: seal("pw", "app_password", KEY) }))).toBe(false);
    expect(keyChanged(deps(), gmailRow({ app_password: null }))).toBe(false);
    expect(keyChanged(deps(), null)).toBe(false);
});

test("checking counts every alert, reads only the five newest, and refuses when not connected", async () => {
    const { gmail } = await connectedDeps();
    const fake = fakeImap({ uids: [3, 9, 1, 12, 7, 5, 11] });
    const result = await check({ ...gmail, imap: fake.factory }, ["jobs@example.com"]);
    expect(result.ok && [result.count, result.newest.map((alert) => alert.subject)]).toEqual([7, ["alert 12", "alert 11", "alert 9", "alert 7", "alert 5"]]);
    expect([fake.queries, fake.fetched]).toEqual([["from:(jobs@example.com) newer_than:7d"], [[12, 11, 9, 7, 5]]]);
    expect(await check({ ...gmail, imap: fakeImap().factory }, ["x.com"])).toEqual({ ok: true, count: 0, newest: [] });
    const unconnected = fakeImap({ uids: [1] });
    expect(await check(deps(unconnected), ["x.com"])).toEqual({ ok: false, reason: "not connected" });
    expect(unconnected.queries).toEqual([]);
});

test("a rejected password or a changed key marks the connection as needing to reconnect", async () => {
    const rejected = await connectedDeps({ fail: new GmailError("bad_login") });
    expect(await check(rejected.gmail, ["x.com"])).toEqual({ ok: false, reason: "app password rejected; create a new one" });
    expect(await rejected.gmail.gmail.connection()).toMatchObject({ status: "needs_reconnect", reason: "app password rejected; create a new one" });
    const changed = await connectedDeps();
    expect(await check({ ...changed.gmail, key: randomBytes(32) }, ["x.com"])).toEqual({ ok: false, reason: "server key changed" });
    const offline = await connectedDeps({ fail: new GmailError("unreachable") });
    expect(await check(offline.gmail, ["x.com"])).toEqual({ ok: false, reason: "Gmail couldn't be reached; try again." });
    expect((await offline.gmail.gmail.connection())?.status).toBe("connected");
});

test("disconnecting forgets the address and password", async () => {
    const { gmail } = await connectedDeps();
    await disconnect(gmail);
    expect(await gmail.gmail.connection()).toMatchObject({ email: null, app_password: null, status: "none" });
});
