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

const CASES: Array<[string, (make: MakeStores) => Promise<void>]> = [["Gmail credentials are saved, replaced and cleared", case1]];

export function gmailStoreContract(make: MakeStores): void {
    for (const [name, run] of CASES) test(name, () => run(make));
}
