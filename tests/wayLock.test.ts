import { expect, test } from "vitest";
import { changeKeepingAWay, newAuthTables, upsertMethod } from "./helpers/memoryAuthTables.js";

test("a change that keeps a usable way is applied once, and one that would leave none is refused without applying it", () => {
    const tables = newAuthTables();
    upsertMethod(tables, { userId: 1, kind: "password", enabled: true, ready: true, passwordDigest: "d", updatedAt: "now" });
    let applied = 0;
    const apply = () => void (applied += 1);
    expect(changeKeepingAWay(tables, 1, { change: { kind: "password", enabled: false, mailOn: true }, apply })).toBe("last_way");
    expect(applied).toBe(0);
    expect(changeKeepingAWay(tables, 1, { change: { kind: "authenticator", enabled: false, mailOn: true }, apply })).toBe("ok");
    expect(applied).toBe(1);
});
