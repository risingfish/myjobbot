import type { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test } from "vitest";
import { storesOver } from "../../src/db/kysely/stores.js";
import type { Database } from "../../src/db/schema.js";
import { makeJob } from "../../src/jobs/job.js";
import { alertJobContract } from "../helpers/alertJobContract.js";
import { appliedContract } from "../helpers/appliedContract.js";
import { careersStoreContract } from "../helpers/careersStoreContract.js";
import { companyContract, type CompanyHooks } from "../helpers/companyContract.js";
import { alertStoreContract } from "../helpers/alertStoreContract.js";
import { descriptionContract } from "../helpers/descriptionContract.js";
import { gmailStoreContract } from "../helpers/gmailStoreContract.js";
import { jobDetailContract } from "../helpers/jobDetailContract.js";
import { searchSettingsContract } from "../helpers/searchSettingsContract.js";
import { storeContract } from "../helpers/storeContract.js";
import { connectTestDb, emptyTables } from "../helpers/testDb.js";

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
    await emptyTables(db);
    return { ...storesOver(db), close: async () => {} };
}

storeContract(emptyStores);
gmailStoreContract(emptyStores);
alertStoreContract(emptyStores);
alertJobContract(emptyStores);
descriptionContract(emptyStores);
jobDetailContract(emptyStores);
companyContract(emptyStores, companyHooks());
appliedContract(emptyStores);
searchSettingsContract(emptyStores, {
    owners: async () => (await db.selectFrom("users").select("id").orderBy("id").execute()).map((row) => row.id),
    seedUser: async (id) => void (await db.insertInto("users").values({ id, name: `user ${id}`, created_at: "2026-10-25T00:00:00.000Z" }).execute()),
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
    const runner = storesOver(db);
    const ui = storesOver(other);
    for (let round = 0; round < rounds; round += 1) {
        const hide = () => ui.jobViews.setHidden({ ats: "greenhouse", jobId: "race", hidden: round % 2 === 1 });
        const score = () => runner.jobStore.recordVerdict({ job_id: "race", score: 50 + round, reasons: [], gaps: [] }, { scoredAt: `2026-10-14T00:00:${String(round).padStart(2, "0")}.000Z`, runId: "race" });
        await Promise.all(round % 2 === 0 ? [hide(), score()] : [score(), hide()]);
    }
}

test("a hide and a verdict on the same job at the same moment both land", async () => {
    const other = await connectTestDb();
    try {
        await emptyTables(db);
        await storesOver(db).jobStore.upsertAll([JOB], "2026-10-14T00:00:00.000Z", "Stripe");
        await raceHideAndScore(other, 20);
        const [job] = await storesOver(db).jobViews.allJobs({ offset: 0, limit: 10 });
        expect([job?.score, job?.hidden, await storesOver(db).jobViews.countVerdicts()]).toEqual([69, true, 20]);
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
