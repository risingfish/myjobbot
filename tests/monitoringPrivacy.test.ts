import { expect, test } from "vitest";
import { OWNER_ID } from "../src/db/owner.js";
import { makeJob } from "../src/jobs/job.js";
import { lookupRows, searchRow } from "../src/web/monitoringLookups.js";
import { runDetailRows, runRows, runsPerDay } from "../src/web/monitoringRuns.js";
import { fetchesPerDay, moduleRows } from "../src/web/monitoringSources.js";
import { mailRows, rescoreRows } from "../src/web/monitoringWork.js";
import { memoryStores, type TestStores } from "./helpers/memoryStore.js";
import { NO_TALLY } from "./helpers/monitoringContract.js";

const AT = "2026-11-10T01:00:00.000Z";
const SEED = { email: "secret-owner@example.com", source: "Secret Source Name", search: "secret search term", address: "https://secret.example/careers", company: "SecretCo", title: "Secret Job Title" };

async function seeded(): Promise<TestStores> {
    const stores = memoryStores();
    await stores.accounts.initOwner({ email: SEED.email, emailKey: SEED.email, passwordDigest: "d" }, AT);
    const source = await stores.sources.save({ module: "jsearch", name: SEED.source, params: { query: SEED.search }, target: "jsearch:secret", enabled: true }, AT);
    await stores.fetches.record({ sourceId: source.id, partId: "part-1", module: "jsearch", at: AT, ms: 5, outcome: "failing", reason: "http_500", pages: 1, jobs: 0, cost: 1 });
    await stores.runHistory.begin("run-1", AT);
    await stores.runHistory.partEnded({ runId: "run-1", userId: OWNER_ID, partId: "part-1", at: AT, endedAt: AT, outcome: "finished", reason: null, totals: NO_TALLY });
    await stores.careers.audit({ runId: "part-1", at: AT, ats: "linkedin", jobId: "1", company: SEED.company, step: "open_careers", url: SEED.address, outcome: "ok", reason: null, warning: false, pageSource: "html", detail: SEED.title });
    await stores.jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "1", company: SEED.company, title: SEED.title, url: SEED.address }, {})], AT, SEED.source);
    await stores.rescoreLog.begin({ ats: "greenhouse", jobId: "1" }, "11111111-1111-4111-8111-111111111111", AT);
    await stores.mailLog.record({ at: AT, kind: "sign_in_link", outcome: "failed", reason: "auth" });
    return stores;
}

test("no monitoring read or view ever holds an email, a source name, a search term, an address, a company or a job title", async () => {
    const { monitoring } = await seeded();
    const now = new Date("2026-11-10T02:00:00.000Z");
    const since = "2026-11-01T00:00:00.000Z";
    const [runs, fetches, lookups, rescores, mails, detail] = await Promise.all([monitoring.runs(since), monitoring.fetches(since), monitoring.lookups(since), monitoring.rescores(since), monitoring.mails(since), monitoring.run("run-1")]);
    const shown = [runs, fetches, lookups, rescores, mails, detail, runRows(runs, now), runsPerDay(runs, now), detail === null ? null : runDetailRows(detail, now), moduleRows(fetches), fetchesPerDay(fetches), lookupRows(lookups), searchRow(runs), rescoreRows(rescores, now), mailRows(mails)];
    expect([runs.length, fetches.length, lookups.length, rescores.length, mails.length]).toEqual([1, 1, 1, 1, 1]);
    const text = JSON.stringify(shown);
    expect(Object.values(SEED).filter((seed) => text.includes(seed))).toEqual([]);
});
