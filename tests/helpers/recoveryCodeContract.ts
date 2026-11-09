import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { OWNER_ID } from "../../src/db/owner.js";
import type { MakeStores } from "./storeContract.js";
import { NOW, withInitialOwner } from "./initialOwner.js";

async function recoveryCodesReplacedAndSpent({ recoveryCodes }: TestStores): Promise<void> {
    await recoveryCodes.replace(OWNER_ID, ["a", "b", "c"], NOW);
    expect(await recoveryCodes.left(OWNER_ID)).toBe(3);
    expect([await recoveryCodes.spend(OWNER_ID, "a", NOW), await recoveryCodes.spend(OWNER_ID, "a", NOW), await recoveryCodes.spend(99, "b", NOW)]).toEqual([true, false, false]);
    expect(await recoveryCodes.left(OWNER_ID)).toBe(2);
    await recoveryCodes.replace(OWNER_ID, ["d", "e"], NOW);
    expect([await recoveryCodes.spend(OWNER_ID, "b", NOW), await recoveryCodes.left(OWNER_ID)]).toEqual([false, 2]);
}

export function recoveryCodeContract(makeStores: MakeStores): void {
    test("a new set of recovery codes replaces the old, each code works once for its own account, and the unused are counted", withInitialOwner(makeStores, recoveryCodesReplacedAndSpent));
}
