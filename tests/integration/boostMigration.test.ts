import { expect, test } from "vitest";
import { migrateBefore, migrateUpTo } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const AT = "2026-11-01T00:00:00.000Z";

const DOCUMENTS = [{ preferences: "Remote", title_boosts: { go: 5, react: 8 } }, { match_threshold: 60 }];

async function seedSettings(db: Awaited<ReturnType<typeof testDatabase>>) {
    await db
        .insertInto("users")
        .values([1, 2].map((id) => ({ id, name: `user ${id}`, created_at: AT })))
        .execute();
    await db
        .insertInto("user_settings")
        .values(DOCUMENTS.map((document, index) => ({ user_id: index + 1, settings: JSON.stringify(document), updated_at: AT })))
        .execute();
}

test("step 016 copies the title boosts into description boosts once, leaving the other documents and every updated_at alone", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "016");
        await seedSettings(db);
        expect(await migrateUpTo(db, "020")).toEqual(["016_description_boosts", "017_resume", "018_accounts", "019_session_details"]);
        const rows = await db.selectFrom("user_settings").select(["settings", "updated_at"]).orderBy("user_id").execute();
        expect(rows).toEqual([
            { settings: { ...DOCUMENTS[0], description_boosts: { go: 5, react: 8 } }, updated_at: AT },
            { settings: DOCUMENTS[1], updated_at: AT },
        ]);
    } finally {
        await db.destroy();
    }
});
