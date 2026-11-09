import { expect, test } from "vitest";
import { columnTypes, migrateBefore, migrateUpTo } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const AT = "2026-11-09T10:00:00.000Z";

test("step 025 adds an account's deactivation and deletion dates, and lets a user who made or used a creation code be deleted, keeping the code", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "025");
        await db.insertInto("users").values({ id: 7, name: "seven", created_at: AT }).execute();
        await db.insertInto("account_codes").values({ digest: "d".repeat(64), created_by: 7, created_at: AT, expires_at: AT, used_by: 7, used_at: AT }).execute();
        expect(await migrateUpTo(db, "026")).toEqual(["025_account_status"]);
        expect(await columnTypes(db, "users", ["deactivated_at", "delete_after"])).toEqual(["deactivated_at varchar(32) YES NULL utf8mb4_bin", "delete_after varchar(32) YES NULL utf8mb4_bin"]);
        expect(await columnTypes(db, "account_codes", ["created_by"])).toEqual(["created_by int(11) YES NULL "]);
        expect(await db.selectFrom("users").select(["deactivated_at", "delete_after"]).where("id", "=", 7).executeTakeFirstOrThrow()).toEqual({ deactivated_at: null, delete_after: null });
        await db.deleteFrom("users").where("id", "=", 7).execute();
        expect(await db.selectFrom("account_codes").select(["created_by", "used_by"]).execute()).toEqual([{ created_by: null, used_by: null }]);
    } finally {
        await db.destroy();
    }
}, 120_000);
