import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testFileConfig } from "./helpers/config.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard, flakyBoard } from "./helpers/http.js";
import { fetchPage } from "./helpers/tools.js";
import { memoryTrace } from "./helpers/trace.js";
import { makeJob } from "../src/jobs/job.js";
import { alertEmail, fixtureJobs, SEARCH_SENDER, searchAlert } from "./helpers/alertEmails.js";
import { alertContext } from "./helpers/alertContext.js";
import { jobPage, searxngJson } from "./helpers/careersPages.js";
import { fakePages, finish, open, POSTING_URL, search } from "./helpers/careersLookup.js";
import { scriptedChat } from "./helpers/chat.js";
import { publicDns } from "./helpers/fakeDns.js";

test("fetch_jobs returns title-filtered unscored jobs without null fields", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Account Executive"])) });
    expect(await fetchPage(context, "stripe")).toEqual({
        source: "Stripe",
        total_unscored: 1,
        jobs: [{ job_id: "1000", title: "Backend Engineer", location: "Remote", posted_at: "2026-09-01T00:00:00.000Z", days_open: 32, possible_ghost: false }],
    });
});

test("fetch_jobs leaves out jobs at excluded companies", async () => {
    const config = testFileConfig({ exclude_companies: ["stripe"] });
    const context = testContext({ config, http: fakeBoard(greenhouseBoard(["Backend Engineer"])) });
    expect(await fetchPage(context, "Stripe")).toMatchObject({ total_unscored: 0, jobs: [] });
});

test("fetch_jobs flags postings open longer than the ghost threshold", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"], "2026-07-01T00:00:00Z")) });
    expect((await fetchPage(context, "Stripe")).jobs[0]).toMatchObject({ days_open: 94, possible_ghost: true });
});

test("fetch_jobs pages 25 jobs at a time", async () => {
    const titles = Array.from({ length: 30 }, (_, index) => `Software Engineer ${index}`);
    const page = await fetchPage(testContext({ http: fakeBoard(greenhouseBoard(titles)) }), "Stripe");
    expect(page.total_unscored).toBe(30);
    expect(page.jobs).toHaveLength(25);
});

test("fetch_jobs hits the board only once per run", async () => {
    const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
    const context = testContext({ http });
    await fetchPage(context, "Stripe");
    await fetchPage(context, "Stripe");
    expect(http.urls).toHaveLength(1);
});

test("fetch_jobs retries a board fetch that failed earlier in the run", async () => {
    const http = flakyBoard(greenhouseBoard(["Backend Engineer"]));
    const context = testContext({ http });
    await expect(fetchPage(context, "Stripe")).rejects.toThrow("temporarily unavailable");
    expect((await fetchPage(context, "Stripe")).total_unscored).toBe(1);
    expect(http.urls).toHaveLength(2);
});

test("fetch_jobs rejects an unknown source", async () => {
    await expect(fetchPage(testContext(), "Initech")).rejects.toThrow('unknown source "Initech"');
});

test("fetch_jobs logs the jobs each board download returned, without descriptions", async () => {
    const jobLog = memoryTrace();
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Account Executive"])), jobLog });
    await fetchPage(context, "Stripe");
    await fetchPage(context, "Stripe");
    expect(jobLog.events).toHaveLength(1);
    expect(jobLog.events[0]).toMatchObject({ type: "board_fetch", company: "Stripe", ats: "greenhouse", slug: "stripe", job_count: 2 });
    expect(jobLog.events[0]?.jobs).toMatchObject([
        { jobId: "1000", title: "Backend Engineer" },
        { jobId: "1001", title: "Account Executive" },
    ]);
    expect(JSON.stringify(jobLog.events[0])).not.toContain("description");
});

test("fetch_jobs pages every unscored alert job, including ones an earlier run left unscored", async () => {
    const context = await alertContext({}, [alertEmail(10, SEARCH_SENDER, searchAlert(fixtureJobs(2), "senior engineer"))]);
    const earlier = makeJob({ ats: "linkedin", jobId: "li_1", company: "Old Co", title: "Senior Engineer", url: "https://x" }, {});
    await context.store.upsertAll([earlier], "2026-10-01T00:00:00.000Z", "Gmail alerts");
    const page = await fetchPage(context, "Gmail alerts");
    expect([page.total_unscored, page.jobs.map((job) => job.job_id).sort()]).toEqual([3, ["li_1", "li_4100000000", "li_4100000001"]]);
    expect(page).toMatchObject({ alerts: { emails: 1, jobs_found: 2, stored: 2 } });
});

test("fetching Gmail alerts looks up careers pages only for unscored jobs without a description that weren't tried before", async () => {
    const base = await alertContext();
    const jobs = ["li_new", "li_described", "li_tried"].map((jobId) => makeJob({ ats: "linkedin", jobId, company: "Acme", title: "Senior Engineer", url: "https://x" }, { description: jobId === "li_described" ? "Known." : null }));
    await base.store.upsertAll(jobs, "2026-10-01T00:00:00.000Z", "Gmail alerts");
    await base.careers.store.audit({ runId: "old", at: "2026-10-01T00:00:00.000Z", ats: "linkedin", jobId: "li_tried", company: "Acme", step: "finish", url: null, outcome: "failed", reason: "job_not_found" });
    const { chat, requests } = scriptedChat([search(), open(1, "job_page"), finish(true)]);
    const careers = { ...base.careers, searxngUrl: "https://search.example", lookup: publicDns(), pages: fakePages({ [POSTING_URL]: jobPage("Senior Engineer", ["Build APIs."]) }) };
    const context = { ...base, chat, careers, http: fakeBoard(searxngJson([{ url: POSTING_URL, title: "Senior Engineer" }])) };
    const page = await fetchPage(context, "Gmail alerts");
    expect(page).toMatchObject({ careers: { looked_up: 1, found: 1 } });
    expect(String(requests[0]?.[0]?.content)).toContain("Senior Engineer at Acme");
    expect(await context.store.findJob("li_new")).toMatchObject({ description_source: "careers", description: expect.stringContaining("Build APIs.") });
});
