import { expect, test } from "vitest";
import type { MakeStores } from "./storeContract.js";

const AT = "2026-10-15T12:00:00.000Z";
const LATER = "2026-10-15T13:00:00.000Z";

async function case1(make: MakeStores) {
    const { gmail } = await make();
    expect(await gmail.connection()).toBeNull();
    await gmail.connected({ email: "first@example.com", sealedPassword: "v1.first" }, AT);
    expect(await gmail.connection()).toEqual({ email: "first@example.com", app_password: "v1.first", connected_at: AT, status: "connected", reason: null });
    await gmail.connected({ email: "second@example.com", sealedPassword: "v1.second" }, LATER);
    expect(await gmail.connection()).toEqual({ email: "second@example.com", app_password: "v1.second", connected_at: LATER, status: "connected", reason: null });
}

async function case2(make: MakeStores) {
    const { gmail } = await make();
    await gmail.connected({ email: "me@example.com", sealedPassword: "v1.pass" }, AT);
    await gmail.needsReconnect("app password rejected; create a new one");
    expect(await gmail.connection()).toEqual({ email: "me@example.com", app_password: "v1.pass", connected_at: AT, status: "needs_reconnect", reason: "app password rejected; create a new one" });
}

async function case3(make: MakeStores) {
    const { gmail } = await make();
    await gmail.connected({ email: "me@example.com", sealedPassword: "v1.pass" }, AT);
    await gmail.disconnect();
    expect(await gmail.connection()).toEqual({ email: null, app_password: null, connected_at: null, status: "none", reason: null });
}

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [
    ["connecting stores the address and sealed password, and connecting again replaces them", case1],
    ["needing to reconnect keeps the address and password and records why", case2],
    ["disconnecting forgets the address and password", case3],
];

export function gmailStoreContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
