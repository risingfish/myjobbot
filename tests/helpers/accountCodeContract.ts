import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { MakeStores } from "./storeContract.js";
import { NOW, withInitialOwner } from "./initialOwner.js";

const ADA = { email: "ada@example.com", emailKey: "ada@example.com", name: "Ada", passwordDigest: "d" };

async function codeExpires({ accounts, accountCodes }: TestStores): Promise<void> {
    await accountCodes.makeCode("early", OWNER_ID, NOW);
    await accountCodes.makeCode("late", OWNER_ID, NOW);
    expect((await accounts.createAccount(ADA, "early", "2026-11-13T09:59:59.000Z")).kind).toBe("created");
    expect(await accounts.createAccount({ ...ADA, email: "b@example.com", emailKey: "b@example.com" }, "late", "2026-11-13T10:00:01.000Z")).toEqual({ kind: "refused" });
}

export function accountCodeContract(makeStores: MakeStores): void {
    test("an account creation code works until 7 days after it was made, and not after", withInitialOwner(makeStores, codeExpires));
}
