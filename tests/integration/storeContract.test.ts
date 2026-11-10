import type { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test } from "vitest";
import { storesOver } from "../../src/db/kysely/stores.js";
import { withOwner } from "../helpers/memoryStore.js";
import type { Database } from "../../src/db/schema.js";
import { makeJob } from "../../src/jobs/job.js";
import { accountStrictCases } from "../helpers/accountContract.js";
import { authenticatorStrictCases } from "../helpers/authenticatorContract.js";
import { userDataStrictCases } from "../helpers/userDataContract.js";
import { userJobStrictCases } from "../helpers/userJobContract.js";
import { keyStrictCases } from "../helpers/keyContract.js";
import { methodStrictCases } from "../helpers/methodContract.js";
import { emailLinkStrictCases } from "../helpers/emailLinkContract.js";
import { alertJobContract } from "../helpers/alertJobContract.js";
import { appliedContract } from "../helpers/appliedContract.js";
import { careersStoreContract } from "../helpers/careersStoreContract.js";
import { accountRemovalContract, type RemovalHooks } from "../helpers/accountRemovalContract.js";
import { companyContract, type CompanyHooks } from "../helpers/companyContract.js";
import { alertStoreContract } from "../helpers/alertStoreContract.js";
import { descriptionContract } from "../helpers/descriptionContract.js";
import { gmailStoreContract } from "../helpers/gmailStoreContract.js";
import { jobDetailContract } from "../helpers/jobDetailContract.js";
import { resumeContract } from "../helpers/resumeContract.js";
import { rescoreContract } from "../helpers/rescoreContract.js";
import { recentContract } from "../helpers/recentContract.js";
import { rescoreLogContract } from "../helpers/rescoreLogContract.js";
import { searchSettingsContract } from "../helpers/searchSettingsContract.js";
import { sourceContract } from "../helpers/sourceContract.js";
import { storeContract } from "../helpers/storeContract.js";
import { connectTestDb, emptyTables, emptyWithOwner } from "../helpers/testDb.js";

let db: Kysely<Database>;

beforeAll(async () => {
    db = await connectTestDb();
});

afterAll(async () => {
    if (!db) return;
    await emptyTables(db);
    await db.destroy();
});

async function emptyStores() {
    await emptyWithOwner(db);
    return withOwner({ ...storesOver(db), close: async () => {} });
}

storeContract(emptyStores);
accountStrictCases(emptyStores);
methodStrictCases(emptyStores);
authenticatorStrictCases(emptyStores);
const twoUsers = {
    seedUsers: async (ids: number[]) =>
        void (await db
            .insertInto("users")
            .values(ids.map((id) => ({ id, name: `user ${id}`, created_at: "2026-11-08T00:00:00.000Z" })))
            .onDuplicateKeyUpdate({ name: (eb) => eb.ref("name") })
            .execute()),
};
userJobStrictCases(emptyStores, twoUsers);
userDataStrictCases(emptyStores, twoUsers);
emailLinkStrictCases(emptyStores);
keyStrictCases(emptyStores);
gmailStoreContract(emptyStores);
alertStoreContract(emptyStores);
alertJobContract(emptyStores);
descriptionContract(emptyStores);
jobDetailContract(emptyStores);
companyContract(emptyStores, companyHooks());
accountRemovalContract(emptyStores, removalHooks, { strict: true });
appliedContract(emptyStores);
rescoreContract(emptyStores);
rescoreLogContract(emptyStores);
recentContract(emptyStores);
resumeContract(emptyStores);
sourceContract(emptyStores, {
    jobLinks: () => db.selectFrom("user_jobs").select(["job_id", "source", "source_id"]).orderBy("job_id").execute(),
    seedCompany: async () => Number((await db.insertInto("companies").values({ company_key: "stripe", name: "Stripe", created_date: "2026-10-28", last_found_date: "2026-10-28" }).executeTakeFirstOrThrow()).insertId),
});
searchSettingsContract(emptyStores, {
    owners: async () => (await db.selectFrom("users").select("id").orderBy("id").execute()).map((row) => row.id),
    seedUser: async (id) =>
        void (await db
            .insertInto("users")
            .values({ id, name: `user ${id}`, created_at: "2026-10-25T00:00:00.000Z" })
            .execute()),
});
careersStoreContract(emptyStores, {
    pageFields: async () => {
        const rows = await db.selectFrom("careers_audit").select(["page_source", "fallback", "board"]).orderBy("id").execute();
        return rows.map((row) => ({ pageSource: row.page_source, fallback: row.fallback, board: row.board }));
    },
    plantRetryOnce: async (entry) => {
        await storesOver(db).careers.audit(entry);
        await db.updateTable("careers_audit").set({ retry_once: 1 }).where("job_id", "=", entry.jobId).where("step", "=", "finish").execute();
    },
    careersRejected: async (key) => {
        const row = await db.selectFrom("companies").select("careers_rejected").where("company_key", "=", key).executeTakeFirst();
        return JSON.parse(row?.careers_rejected ?? "[]") as string[];
    },
});

const JOB = makeJob({ ats: "greenhouse", jobId: "race", company: "Acme", title: "Backend Engineer", url: "u" }, {});

async function raceHideAndScore(other: Kysely<Database>, rounds: number): Promise<void> {
    const runner = storesOver(db).forUser(1);
    const ui = storesOver(other).forUser(1);
    for (let round = 0; round < rounds; round += 1) {
        const hide = () => ui.jobViews.setHidden({ ats: "greenhouse", jobId: "race", hidden: round % 2 === 1 });
        const score = () => runner.jobStore.recordVerdict({ job_id: "race", score: 50 + round, reasons: [], gaps: [] }, { scoredAt: `2026-10-14T00:00:${String(round).padStart(2, "0")}.000Z`, runId: "race" });
        await Promise.all(round % 2 === 0 ? [hide(), score()] : [score(), hide()]);
    }
}

test("a hide and a verdict on the same job at the same moment both land", async () => {
    const other = await connectTestDb();
    try {
        await emptyWithOwner(db);
        await storesOver(db).forUser(1).jobStore.upsertAll([JOB], "2026-10-14T00:00:00.000Z", "Stripe");
        await raceHideAndScore(other, 20);
        const [job] = await storesOver(db).forUser(1).jobViews.allJobs({ offset: 0, limit: 10 });
        expect([job?.score, job?.hidden, await storesOver(db).forUser(1).jobViews.countVerdicts()]).toEqual([69, true, 20]);
    } finally {
        await other.destroy();
    }
});

function companyHooks(): CompanyHooks {
    return {
        listCompanies: () => db.selectFrom("companies").select(["id", "company_key", "name", "created_date", "last_found_date"]).orderBy("id").execute(),
        jobLinks: () => db.selectFrom("jobs").select(["job_id", "company_id"]).orderBy("job_id").execute(),
        seedUnlinked: async (jobs) => {
            const rows = jobs.map((job) => ({ ats: "greenhouse", job_id: job.jobId, company: job.company, source: job.company, title: "Engineer", normalized_title: "engineer", url: "u", first_seen: job.firstSeen, last_seen: job.lastSeen }));
            await db.insertInto("jobs").values(rows).execute();
        },
        searchOutcome: (key) => db.selectFrom("companies").select(["website_url", "website_reason", "website_rejected", "careers_url", "careers_reason", "careers_rejected", "searched_at"]).where("company_key", "=", key).executeTakeFirst(),
        seedBoardPage: async (key, url) => {
            const at = "2026-10-01T00:00:00.000Z";
            await db.insertInto("companies").values({ company_key: key, name: key, created_date: at, last_found_date: at, careers_url: url, careers_source: "board" }).execute();
        },
    };
}

const USER_TABLES = ["user_jobs", "verdicts", "rescore_runs", "gmail_alert_state", "gmail_connection", "resume_profiles", "resumes", "user_sources", "user_settings", "sign_in_methods", "hardware_keys", "recovery_codes", "sessions", "email_tokens", "auth_challenges", "security_events"] as const;
const SHARED_TABLES = ["jobs", "companies", "careers_audit", "api_calls", "auth_attempts", "account_codes"] as const;

async function rowCount(table: (typeof USER_TABLES)[number] | (typeof SHARED_TABLES)[number], userId?: number): Promise<number> {
    const query = db.selectFrom(table).select((eb) => eb.fn.countAll<number>().as("n"));
    const row = await (userId === undefined ? query : query.where("user_id" as never, "=", userId as never)).executeTakeFirstOrThrow();
    return Number(row.n);
}

function removalHooks(): RemovalHooks {
    return {
        userRows: async (userId) => Object.fromEntries(await Promise.all(USER_TABLES.map(async (table) => [table, await rowCount(table, userId)]))),
        sharedCounts: async () => Object.fromEntries(await Promise.all(SHARED_TABLES.map(async (table) => [table, await rowCount(table)]))),
        codes: async () => (await db.selectFrom("account_codes").select(["created_by", "used_by"]).execute()).map((row) => ({ createdBy: row.created_by, usedBy: row.used_by })),
    };
}
