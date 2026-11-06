import { expect, test } from "vitest";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";

export function methodContract(makeStores: MakeStores): void {
    test("setting a password enables and readies password sign-in with the new digest", async () => {
        const stores = await makeStores();
        try {
            await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "old" }, NOW);
            await stores.methods.setPassword(OWNER_ID, "new", NOW);
            expect(await stores.methods.passwordDigest(OWNER_ID)).toBe("new");
            expect(await stores.methods.passwordDigest(99)).toBeNull();
        } finally {
            await stores.close();
        }
    });
}
