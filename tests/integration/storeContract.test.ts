import type { Kysely } from "kysely";
import { afterAll, beforeAll, expect, test } from "vitest";
import { storesOver } from "../../src/db/kysely/stores.js";
import type { Database } from "../../src/db/schema.js";
import { makeJob } from "../../src/jobs/job.js";
import { alertJobContract } from "../helpers/alertJobContract.js";
import { alertStoreContract } from "../helpers/alertStoreContract.js";
import { descriptionContract } from "../helpers/descriptionContract.js";
import { gmailStoreContract } from "../helpers/gmailStoreContract.js";
import { storeContract } from "../helpers/storeContract.js";
import { connectTestDb, emptyTables } from "../helpers/testDb.js";

let db: Kysely<Database>;

beforeAll(async () => {
    db = await connectTestDb();
});

afterAll(async () => {
    if (db) await db.destroy();
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
