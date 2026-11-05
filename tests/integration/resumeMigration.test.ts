import { sql } from "kysely";
import { expect, test } from "vitest";
import { migrateToLatest } from "../../src/db/migrate.js";
import { columnTypes, migrateBefore } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const RESUME_TYPES = ["content_id char(16) NO  utf8mb4_bin", "file_name varchar(255) NO  utf8mb4_bin", "file_type varchar(8) NO  utf8mb4_bin", "text mediumtext NO  utf8mb4_bin", "uploaded_at varchar(32) NO  utf8mb4_bin", "user_id int(11) NO  "];
const PROFILE_TYPES = ["edited_at varchar(32) YES NULL utf8mb4_bin", "extracted_at varchar(32) NO  utf8mb4_bin", "resume_id char(16) NO  utf8mb4_bin", "skills text NO  utf8mb4_bin", "summary text NO  utf8mb4_bin", "user_id int(11) NO  "];

test("step 017 adds the resume and its profile, one row per user, each tied to its user", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "017");
        expect(await migrateToLatest(db)).toEqual(["017_resume"]);
        expect(await columnTypes(db, "resumes", ["user_id", "text", "file_name", "file_type", "uploaded_at", "content_id"])).toEqual(RESUME_TYPES);
        expect(await columnTypes(db, "resume_profiles", ["user_id", "resume_id", "summary", "skills", "extracted_at", "edited_at"])).toEqual(PROFILE_TYPES);
        const keys = await sql<{ TABLE_NAME: string; REFERENCED_TABLE_NAME: string }>`SELECT TABLE_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('resumes', 'resume_profiles') AND REFERENCED_TABLE_NAME IS NOT NULL`.execute(db);
        expect(keys.rows.map((row) => `${row.TABLE_NAME}>${row.REFERENCED_TABLE_NAME}`).sort()).toEqual(["resume_profiles>users", "resumes>users"]);
    } finally {
        await db.destroy();
    }
});
