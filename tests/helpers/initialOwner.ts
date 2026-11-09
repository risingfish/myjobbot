import type { TestStores } from "./memoryStore.js";
import type { MakeStores } from "./storeContract.js";

export const NOW = "2026-11-06T10:00:00.000Z";

export function withInitialOwner(makeStores: MakeStores, check: (stores: TestStores) => Promise<void>) {
    return async () => {
        const stores = await makeStores();
        try {
            await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, NOW);
            await check(stores);
        } finally {
            await stores.close();
        }
    };
}
