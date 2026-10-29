import { sql } from "kysely";
import { expect, test } from "vitest";
import { migrateToLatest } from "../../src/db/migrate.js";
import { columnTypes, migrateBefore, storedJob } from "../helpers/migrationSteps.js";
import { testDatabase } from "../helpers/testDb.js";

const COMPANY_COLUMNS = ["id", "company_key", "name", "website_url", "careers_url", "careers_source", "created_date", "last_found_date", "searched_at", "website_reason", "website_rejected", "careers_reason", "careers_rejected"];

const COMPANY_TYPES = [
    "careers_reason varchar(32) YES NULL utf8mb4_bin",
    "careers_rejected text YES NULL utf8mb4_bin",
    "careers_source varchar(16) YES NULL utf8mb4_bin",
    "careers_url varchar(2048) YES NULL utf8mb4_bin",
    "company_key varchar(255) NO  utf8mb4_bin",
    "created_date varchar(32) NO  utf8mb4_bin",
    "id int(11) NO  ",
    "last_found_date varchar(32) NO  utf8mb4_bin",
    "name varchar(255) NO  utf8mb4_bin",
    "searched_at varchar(32) YES NULL utf8mb4_bin",
    "website_reason varchar(32) YES NULL utf8mb4_bin",
    "website_rejected text YES NULL utf8mb4_bin",
    "website_url varchar(2048) YES NULL utf8mb4_bin",
];

test("step 009 adds an empty companies table and a company link on every job, unset for jobs already there", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "009");
        await db.insertInto("jobs").values([storedJob("one", null), storedJob("two", null)]).execute();
        expect(await migrateToLatest(db)).toEqual(["009_companies", "010_fold_careers_pages", "011_user_settings", "012_user_sources", "013_move_sources"]);
        expect([await db.selectFrom("companies").selectAll().execute(), await db.selectFrom("jobs").select("company_id").execute()]).toEqual([[], [{ company_id: null }, { company_id: null }]]);
        expect(await columnTypes(db, "companies", COMPANY_COLUMNS)).toEqual(COMPANY_TYPES);
        expect(await columnTypes(db, "jobs", ["company_id"])).toEqual(["company_id int(11) YES NULL "]);
    } finally {
        await db.destroy();
    }
});

type PagesAtStep009 = { careers_pages: { company_key: string; company: string; url: string; found_at: string; last_used_at: string } };

function company(key: string, boardPage: string | null) {
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    return { company_key: key, name, created_date: "2026-08-01T00:00:00.000Z", last_found_date: "2026-10-01T00:00:00.000Z", careers_url: boardPage, careers_source: boardPage === null ? null : "board" };
}

function rememberedPage(key: string, company: string, url: string) {
    return { company_key: key, company, url, found_at: "2026-09-01T00:00:00.000Z", last_used_at: "2026-09-02T00:00:00.000Z" };
}

test("step 010 moves remembered careers pages onto company records, creating any that are missing, and drops their table", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "010");
        await db.insertInto("companies").values([company("acme", null), company("gamma", "https://jobs.lever.co/gamma")]).execute();
        await db.withTables<PagesAtStep009>().insertInto("careers_pages").values([rememberedPage("acme", "Acme Inc", "https://acme.example/careers"), rememberedPage("beta labs", "Beta Labs", "https://beta.example/jobs"), rememberedPage("gamma", "Gamma", "https://gamma.example/careers")]).execute();
        expect(await migrateToLatest(db)).toEqual(["010_fold_careers_pages", "011_user_settings", "012_user_sources", "013_move_sources"]);
        const pages = await db.selectFrom("companies").select(["company_key", "name", "careers_url", "careers_source", "created_date", "last_found_date"]).orderBy("company_key").execute();
        expect(pages).toEqual([
            { company_key: "acme", name: "Acme", careers_url: "https://acme.example/careers", careers_source: "lookup", created_date: "2026-08-01T00:00:00.000Z", last_found_date: "2026-10-01T00:00:00.000Z" },
            { company_key: "beta labs", name: "Beta Labs", careers_url: "https://beta.example/jobs", careers_source: "lookup", created_date: "2026-09-01T00:00:00.000Z", last_found_date: "2026-09-01T00:00:00.000Z" },
            { company_key: "gamma", name: "Gamma", careers_url: "https://jobs.lever.co/gamma", careers_source: "board", created_date: "2026-08-01T00:00:00.000Z", last_found_date: "2026-10-01T00:00:00.000Z" },
        ]);
        expect((await sql`SHOW TABLES LIKE 'careers_pages'`.execute(db)).rows).toEqual([]);
    } finally {
        await db.destroy();
    }
});

const USER_TYPES = ["created_at varchar(32) NO  utf8mb4_bin", "id int(11) NO  ", "name varchar(255) NO  utf8mb4_bin"];

const USER_SETTINGS_TYPES = ["settings longtext NO  utf8mb4_bin", "updated_at varchar(32) NO  utf8mb4_bin", "user_id int(11) NO  "];

test("step 011 adds empty users and user settings tables", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "011");
        expect(await migrateToLatest(db)).toEqual(["011_user_settings", "012_user_sources", "013_move_sources"]);
        expect([await db.selectFrom("users").selectAll().execute(), await db.selectFrom("user_settings").selectAll().execute()]).toEqual([[], []]);
        expect(await columnTypes(db, "users", ["id", "name", "created_at"])).toEqual(USER_TYPES);
        expect(await columnTypes(db, "user_settings", ["user_id", "settings", "updated_at"])).toEqual(USER_SETTINGS_TYPES);
    } finally {
        await db.destroy();
    }
});

const SOURCE_COLUMNS = ["id", "user_id", "module", "name", "params", "target", "enabled", "company_id", "cursor", "last_fetched_at", "last_outcome", "last_jobs", "last_cost", "last_reason", "created_at", "updated_at"];

const SOURCE_TYPES = ["company_id int(11) YES NULL ", "created_at varchar(32) NO  utf8mb4_bin", "cursor longtext YES NULL utf8mb4_bin", "enabled tinyint(4) NO  ", "id int(11) NO  ", "last_cost int(11) YES NULL ", "last_fetched_at varchar(32) YES NULL utf8mb4_bin", "last_jobs int(11) YES NULL ", "last_outcome varchar(16) YES NULL utf8mb4_bin", "last_reason varchar(255) YES NULL utf8mb4_bin", "module varchar(32) NO  utf8mb4_bin", "name varchar(255) NO  utf8mb4_bin", "params longtext NO  utf8mb4_bin", "target varchar(512) NO  utf8mb4_bin", "updated_at varchar(32) NO  utf8mb4_bin", "user_id int(11) NO  "];

const AT = "2026-10-28T00:00:00.000Z";

const STRIPE_ENTRY = { name: "Stripe", ats: "greenhouse", slug: "Stripe" };

const OWNER_DOCUMENT = { companies: [STRIPE_ENTRY, { name: "Palantir", ats: "lever", slug: "palantir" }, { ...STRIPE_ENTRY, name: "Stripe again", slug: "stripe" }, { name: "Taleo Co", ats: "taleo", slug: "taleo" }], searches: [{ name: "Remote backend", query: "Backend Engineer", remote_only: true }], match_threshold: 60 };

const JOB_SOURCES = { s1: "Stripe", s2: "Stripe again", l1: "Palantir", q1: "Remote backend", g1: "Gmail alerts", x1: "Removed" };

async function seedOwner(db: Awaited<ReturnType<typeof testDatabase>>) {
    await db.insertInto("users").values({ id: 1, name: "owner", created_at: AT }).execute();
    await db.insertInto("user_settings").values({ user_id: 1, settings: JSON.stringify(OWNER_DOCUMENT), updated_at: AT }).execute();
    await db.insertInto("jobs").values(Object.entries(JOB_SOURCES).map(([id, source]) => ({ ...storedJob(id, null), source }))).execute();
}

async function expectMovedSources(db: Awaited<ReturnType<typeof testDatabase>>) {
    const sources = await db.selectFrom("user_sources").select(["id", "module", "name", "params", "target", "enabled"]).orderBy("id").execute();
    expect(sources.map(({ id: _id, ...source }) => source)).toEqual([
        { module: "greenhouse", name: "Stripe", params: { slug: "Stripe" }, target: "greenhouse:stripe", enabled: 1 },
        { module: "lever", name: "Palantir", params: { slug: "palantir" }, target: "lever:palantir", enabled: 1 },
        { module: "jsearch", name: "Remote backend", params: { query: "Backend Engineer", remote_only: true }, target: "jsearch:backend engineer|us|true", enabled: 1 },
        { module: "gmail_alerts", name: "Gmail alerts", params: {}, target: "gmail_alerts", enabled: 1 },
    ]);
    expect((await db.selectFrom("user_settings").select("settings").executeTakeFirstOrThrow()).settings).toEqual({ match_threshold: 60 });
    const ids = sources.map((source) => source.id);
    const links = await db.selectFrom("jobs").select(["job_id", "source_id"]).orderBy("job_id").execute();
    expect(links).toEqual([
        { job_id: "g1", source_id: ids[3] },
        { job_id: "l1", source_id: ids[1] },
        { job_id: "q1", source_id: ids[2] },
        { job_id: "s1", source_id: ids[0] },
        { job_id: "s2", source_id: ids[0] },
        { job_id: "x1", source_id: null },
    ]);
}

test("steps 012 and 013 move each user's boards and searches into saved sources and link their jobs, and do nothing on a fresh install", async () => {
    const db = await testDatabase();
    try {
        await migrateBefore(db, "012");
        expect([await migrateToLatest(db), await db.selectFrom("user_sources").selectAll().execute()]).toEqual([["012_user_sources", "013_move_sources"], []]);
        await migrateBefore(db, "012");
        await seedOwner(db);
        await migrateToLatest(db);
        expect([await columnTypes(db, "user_sources", SOURCE_COLUMNS), await columnTypes(db, "jobs", ["source_id"])]).toEqual([SOURCE_TYPES, ["source_id int(11) YES NULL "]]);
        await expectMovedSources(db);
    } finally {
        await db.destroy();
    }
});
