import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { keyChanged, saveCredentials } from "../src/gmail/connection.js";
import { openSealed, seal } from "../src/gmail/seal.js";
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
