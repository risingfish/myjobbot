import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { GoogleError } from "../src/gmail/googleErrors.js";
import { finishConnect, keyChanged, saveCredentials, startConnect, type GmailDeps } from "../src/gmail/connection.js";
import { openSealed, seal } from "../src/gmail/seal.js";
import { fakeGoogle, type FakeGoogle } from "./helpers/fakeGoogle.js";
import { gmailRow } from "./helpers/gmailRows.js";
import { memoryStores } from "./helpers/memoryStore.js";

const KEY = randomBytes(32);
const NOW = new Date("2026-10-15T12:00:00.000Z");

function deps() {
    return { gmail: memoryStores().gmail, key: KEY };
}

test("saving credentials seals the secret, and wrong lengths are refused without storing", async () => {
    const gmail = deps();
    expect(await saveCredentials(gmail, { clientId: " client-1 ", clientSecret: "secret-1" }, NOW)).toEqual({ ok: true, error: null });
    const row = await gmail.gmail.connection();
    expect(row?.client_id).toBe("client-1");
    expect(openSealed(row?.client_secret ?? "", "client_secret", KEY)).toBe("secret-1");
    const fresh = deps();
    for (const input of [
        { clientId: "", clientSecret: "s" },
        { clientId: "c", clientSecret: "x".repeat(256) },
    ]) {
        expect((await saveCredentials(fresh, input, NOW)).ok).toBe(false);
    }
    expect(await fresh.gmail.connection()).toBeNull();
});

test("a key change is noticed when the saved secret no longer opens", () => {
    const sealedElsewhere = seal("secret", "client_secret", randomBytes(32));
    expect(keyChanged(deps(), gmailRow({ client_secret: sealedElsewhere }))).toBe(true);
    expect(keyChanged(deps(), gmailRow({ client_secret: seal("secret", "client_secret", KEY) }))).toBe(false);
    expect(keyChanged(deps(), gmailRow({ client_secret: null }))).toBe(false);
    expect(keyChanged(deps(), null)).toBe(false);
});

async function savedDeps(fake: FakeGoogle): Promise<GmailDeps> {
    const gmail = { ...deps(), google: fake.factory };
    await saveCredentials(gmail, { clientId: "client-1", clientSecret: "secret-1" }, NOW);
    return gmail;
}

function stateOf(url: string): string {
    return new URL(url).searchParams.get("state") ?? "";
}

test("starting a connection stores a sealed verifier, prunes stale requests and returns Google's URL", async () => {
    const fake = fakeGoogle();
    const gmail = await savedDeps(fake);
    await gmail.gmail.addConnectRequest("stale", "v1.old", "2026-10-15T11:00:00.000Z");
    const started = await startConnect(gmail, "localhost:8080", NOW);
    if (!started.ok) throw new Error(started.reason);
    expect(fake.clients).toEqual([{ clientId: "client-1", clientSecret: "secret-1", redirectUri: "http://localhost:8080/settings/gmail/callback" }]);
    expect(fake.authOptions[0]).toMatchObject({ scope: ["https://www.googleapis.com/auth/gmail.readonly"], code_challenge_method: "S256" });
    const request = await gmail.gmail.takeConnectRequest(stateOf(started.url));
    expect(openSealed(request?.sealedVerifier ?? "", "code_verifier", KEY)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await gmail.gmail.takeConnectRequest("stale")).toBeNull();
});

test("finishing a connection stores the sealed refresh token and the address, once", async () => {
    const fake = fakeGoogle();
    const gmail = await savedDeps(fake);
    const started = await startConnect(gmail, "localhost:8080", NOW);
    const callback = { state: started.ok ? stateOf(started.url) : "", code: "code-1", error: null, host: "localhost:8080" };
    expect(await finishConnect(gmail, callback, NOW)).toBe("connected");
    const row = await gmail.gmail.connection();
    expect([row?.status, row?.email, openSealed(row?.refresh_token ?? "", "refresh_token", KEY)]).toEqual(["connected", "me@example.com", "refresh-1"]);
    expect(fake.exchanges[0]?.[0]).toBe("code-1");
    expect(await finishConnect(gmail, callback, NOW)).toBe("refused");
});

test("a denied, unknown, rejected or failed sign-in changes nothing and says why", async () => {
    const failures: Array<[string, () => Promise<never>]> = [
        ["bad_client", async () => Promise.reject(new GoogleError("invalid_client"))],
        ["failed", async () => Promise.reject(new GoogleError("network"))],
    ];
    for (const [outcome, exchange] of failures) {
        const gmail = await savedDeps(fakeGoogle(exchange));
        const started = await startConnect(gmail, "localhost:8080", NOW);
        expect(await finishConnect(gmail, { state: started.ok ? stateOf(started.url) : "", code: "c", error: null, host: "localhost:8080" }, NOW)).toBe(outcome);
        expect((await gmail.gmail.connection())?.status).toBe("none");
    }
    const gmail = await savedDeps(fakeGoogle());
    expect(await finishConnect(gmail, { state: "x", code: null, error: "access_denied", host: "localhost:8080" }, NOW)).toBe("denied");
    expect(await finishConnect(gmail, { state: "unknown", code: "c", error: null, host: "localhost:8080" }, NOW)).toBe("refused");
    const started = await startConnect(gmail, "localhost:8080", NOW);
    const otherKey = { ...gmail, key: randomBytes(32) };
    expect(await finishConnect(otherKey, { state: started.ok ? stateOf(started.url) : "", code: "c", error: null, host: "localhost:8080" }, NOW)).toBe("key_changed");
    expect((await gmail.gmail.connection())?.status).toBe("none");
});
