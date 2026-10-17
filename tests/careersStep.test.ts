import { expect, test } from "vitest";
import type { AuditEntry } from "../src/db/store.js";
import { makeJob } from "../src/jobs/job.js";
import { alertContext } from "./helpers/alertContext.js";
import { jobPage, searxngJson } from "./helpers/careersPages.js";
import { fakePages, finish, open, POSTING_URL, search } from "./helpers/careersLookup.js";
import { scriptedChat } from "./helpers/chat.js";
import { publicDns } from "./helpers/fakeDns.js";
import { fakeBoard } from "./helpers/http.js";
import { MemoryCareersStore } from "./helpers/memoryCareersStore.js";
import { fetchPage } from "./helpers/tools.js";

const SEEN = "2026-10-01T00:00:00.000Z";

function finished(jobId: string, reason: string): AuditEntry {
    return { runId: "old", at: SEEN, ats: "linkedin", jobId, company: "Acme", step: "finish", url: null, outcome: "failed", reason };
}

async function scoredAlertJobs(jobIds: string[]) {
    const base = await alertContext();
    await base.store.upsertAll(jobIds.map((jobId) => makeJob({ ats: "linkedin", jobId, company: "Acme", title: "Senior Engineer", url: "https://x" }, {})), SEEN, "Gmail alerts");
    for (const jobId of jobIds) await base.store.recordVerdict({ job_id: jobId, score: 0, reasons: [], gaps: [] }, { scoredAt: SEEN, runId: "old" });
    const store = new MemoryCareersStore();
    const { chat, requests } = scriptedChat([search(), open(1, "job_page"), finish(true)]);
    const careers = { ...base.careers, store, searxngUrl: "https://search.example", lookup: publicDns(), pages: fakePages({ [POSTING_URL]: jobPage("Senior Engineer", ["Build APIs."]) }) };
    return { context: { ...base, chat, careers, http: fakeBoard(searxngJson([{ url: POSTING_URL, title: "Senior Engineer" }])) }, store, requests };
}

test("an already-scored alert job owed a retry is looked up again and, once found, is listed for scoring in the same run", async () => {
    const { context, store } = await scoredAlertJobs(["li_retry"]);
    store.rows.push({ ...finished("li_retry", "job_page_unreadable"), retryOnce: true });
    const page = await fetchPage(context, "Gmail alerts");
    expect(page).toMatchObject({ careers: { looked_up: 1, found: 1 }, total_unscored: 1 });
    expect(store.rows[1]).toMatchObject({ jobId: "li_retry", step: "retry" });
    expect(await context.store.findJob("li_retry")).toMatchObject({ description_source: "careers", scored_at: null });
});

test("an already-scored alert job whose lookup ended for good is not looked up again", async () => {
    const { context, store, requests } = await scoredAlertJobs(["li_done"]);
    store.rows.push(finished("li_done", "job_not_found"));
    expect(await fetchPage(context, "Gmail alerts")).toMatchObject({ careers: { looked_up: 0 }, total_unscored: 0 });
    expect(requests).toEqual([]);
});
