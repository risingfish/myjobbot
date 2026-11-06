import { expect, test } from "vitest";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { MakeStores } from "./storeContract.js";

const NOW = "2026-11-06T10:00:00.000Z";
const ADA = { email: "ada@example.com", emailKey: "ada@example.com", name: "Ada", passwordDigest: "d" };

export function tokenContract(makeStores: MakeStores): void {
    test("an account creation code works until 7 days after it was made, and not after", async () => {
        const stores = await makeStores();
        try {
            await stores.accounts.initOwner({ email: "o@example.com", emailKey: "o@example.com", passwordDigest: "d" }, NOW);
            await stores.tokens.makeCode("early", OWNER_ID, NOW);
            await stores.tokens.makeCode("late", OWNER_ID, NOW);
            expect((await stores.accounts.createAccount(ADA, "early", "2026-11-13T09:59:59.000Z")).kind).toBe("created");
            expect(await stores.accounts.createAccount({ ...ADA, email: "b@example.com", emailKey: "b@example.com" }, "late", "2026-11-13T10:00:01.000Z")).toEqual({ kind: "refused" });
        } finally {
            await stores.close();
        }
    });
}
