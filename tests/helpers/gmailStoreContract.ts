import { expect, test } from "vitest";
import type { MakeStores } from "./storeContract.js";

const AT = "2026-10-15T12:00:00.000Z";
const LATER = "2026-10-15T13:00:00.000Z";

async function case1(make: MakeStores) {
    const { gmail } = await make();
    expect(await gmail.connection()).toBeNull();
    await gmail.saveCredentials("client-1", "v1.sealed-1", AT);
    expect(await gmail.connection()).toMatchObject({ client_id: "client-1", client_secret: "v1.sealed-1", credentials_saved_at: AT, status: "none" });
    await gmail.saveCredentials("client-2", "v1.sealed-2", LATER);
    expect(await gmail.connection()).toMatchObject({ client_id: "client-2", client_secret: "v1.sealed-2", credentials_saved_at: LATER });
    await gmail.clearCredentials();
    expect(await gmail.connection()).toEqual({ client_id: null, client_secret: null, credentials_saved_at: null, refresh_token: null, email: null, connected_at: null, status: "none", reason: null });
}

async function case2(make: MakeStores) {
    const { gmail } = await make();
    await gmail.saveCredentials("client-1", "v1.sealed-1", AT);
    await gmail.connected({ sealedToken: "v1.token-1", email: "first@example.com" }, AT);
    expect(await gmail.connection()).toMatchObject({ client_id: "client-1", refresh_token: "v1.token-1", email: "first@example.com", connected_at: AT, status: "connected", reason: null });
    await gmail.connected({ sealedToken: "v1.token-2", email: "second@example.com" }, LATER);
    expect(await gmail.connection()).toMatchObject({ refresh_token: "v1.token-2", email: "second@example.com", connected_at: LATER });
}

async function case3(make: MakeStores) {
    const { gmail } = await make();
    await gmail.addConnectRequest("state-1", "v1.verifier-1", AT);
    expect(await gmail.takeConnectRequest("state-1")).toEqual({ sealedVerifier: "v1.verifier-1", createdAt: AT });
    expect(await gmail.takeConnectRequest("state-1")).toBeNull();
    expect(await gmail.takeConnectRequest("STATE-1")).toBeNull();
}

async function case4(make: MakeStores) {
    const { gmail } = await make();
    await gmail.addConnectRequest("old", "v1.old", AT);
    await gmail.addConnectRequest("new", "v1.new", LATER);
    await gmail.pruneConnectRequests(LATER);
    expect(await gmail.takeConnectRequest("old")).toBeNull();
    expect(await gmail.takeConnectRequest("new")).not.toBeNull();
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["Gmail credentials are saved, replaced and cleared", case1],
    ["connecting stores the sealed token and address, and a second connection replaces the first", case2],
    ["a connect request is taken once, by its exact state", case3],
    ["pruning removes only connect requests older than the cutoff", case4],
];

export function gmailStoreContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
