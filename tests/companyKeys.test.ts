import { expect, test } from "vitest";
import { companyKeys } from "../src/companies/keys.js";

const DAY_ONE = "2026-10-01T00:00:00.000Z";
const DAY_TWO = "2026-10-02T00:00:00.000Z";
const DAY_THREE = "2026-10-03T00:00:00.000Z";

function seen(name: string, firstSeen = DAY_ONE, lastSeen = firstSeen) {
    return { name, firstSeen, lastSeen };
}

test("names that differ only in case, punctuation or a legal suffix are one company", () => {
    expect(companyKeys([seen("Acme"), seen("ACME, Inc."), seen("Acme LLC")]).map((entry) => entry.key)).toEqual(["acme"]);
});

test("two companies give two keys", () => {
    expect(companyKeys([seen("Acme"), seen("Beta Labs")]).map((entry) => entry.key)).toEqual(["acme", "beta labs"]);
});

test("a name with no letters or digits gives no company", () => {
    expect(companyKeys([seen("!!!"), seen("  ")])).toEqual([]);
});

test("a company keeps the earliest first-seen and the latest last-seen of its jobs", () => {
    const [acme] = companyKeys([seen("Acme", DAY_TWO, DAY_TWO), seen("Acme Inc", DAY_ONE, DAY_ONE), seen("ACME", DAY_TWO, DAY_THREE)]);
    expect(acme).toMatchObject({ firstSeen: DAY_ONE, lastSeen: DAY_THREE });
});

test("a company is named after its earliest-seen job whatever the order, and the earlier entry wins a tie", () => {
    expect(companyKeys([seen("ACME Inc", DAY_TWO), seen("Acme", DAY_ONE)])[0]?.name).toBe("Acme");
    expect(companyKeys([seen("Acme", DAY_ONE), seen("ACME Inc", DAY_ONE)])[0]?.name).toBe("Acme");
});
