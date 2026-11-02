import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testAppSettings } from "./helpers/config.js";
import { ALERTS_REF, testContext } from "./helpers/context.js";
import { newRunState } from "../src/tools/context.js";
import { fakeBoard, flakyBoard } from "./helpers/http.js";
import { invokeTool, nextPage } from "./helpers/tools.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { memoryTrace } from "./helpers/trace.js";
import { makeJob } from "../src/jobs/job.js";
import { alertEmail, fixtureJobs, SEARCH_SENDER, searchAlert } from "./helpers/alertEmails.js";
import { alertContext } from "./helpers/alertContext.js";
import { jobPage, searxngJson } from "./helpers/careersPages.js";
import { fakePages, finish, open, POSTING_URL, search } from "./helpers/careersLookup.js";
import { scriptedChat } from "./helpers/chat.js";
import { publicDns } from "./helpers/fakeDns.js";

test("next_jobs returns title-filtered unscored jobs without null fields", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Account Executive"])) });
    expect(await nextPage(context, "stripe")).toEqual({
        source: "Stripe",
        total_unscored: 1,
        jobs: [{ job_id: "1000", title: "Backend Engineer", location: "Remote", posted_at: "2026-09-01T00:00:00.000Z", days_open: 32, possible_ghost: false }],
    });
});

test("next_jobs leaves out jobs at excluded companies", async () => {
    const config = testAppSettings({ exclude_companies: ["stripe"] });
    const tables = newTables();
    const context = testContext({ config, http: fakeBoard(greenhouseBoard(["Backend Engineer"])) }, memoryStores(tables));
    expect(await nextPage(context, "Stripe")).toMatchObject({ total_unscored: 0, jobs: [] });
    expect(tables.companies.map((company) => company.company_key)).toEqual(["stripe"]);
});

const BODY_FILTER = { body_filter: { include: ["typescript", "golang"], exclude: ["clearance"] } };

function describedBoard(contents: Array<string | null>) {
    return fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer", "Frontend Engineer"], undefined, contents));
}

test("next_jobs leaves out jobs whose description holds an excluded term or none of the included ones", async () => {
    const http = describedBoard(["<p>TypeScript, clearance required</p>", "<p>We write Java</p>", "<p>Golang services</p>"]);
    const page = await nextPage(testContext({ config: testAppSettings(BODY_FILTER), http }), "Stripe");
    expect([page.total_unscored, page.jobs.map((job) => job.title)]).toEqual([1, ["Frontend Engineer"]]);
});

test("next_jobs offers a job with no description whatever the body filter holds", async () => {
    const page = await nextPage(testContext({ config: testAppSettings(BODY_FILTER), http: describedBoard([null, null, null]) }), "Stripe");
    expect(page.total_unscored).toBe(3);
});

test("with only body-filtered jobs left, list_sources counts none unscored and finish ends the run", async () => {
    const context = testContext({ config: testAppSettings(BODY_FILTER), http: describedBoard(["Clearance", "Clearance", "Clearance"]) });
    await nextPage(context, "Stripe");
    expect(await invokeTool(context, "list_sources", {})).toMatchObject([{ name: "Stripe", total_unscored: 0 }]);
    expect(await invokeTool(context, "finish", { summary: "done" })).toEqual({ ok: true });
});

test("next_jobs flags postings open longer than the ghost threshold", async () => {
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"], "2026-07-01T00:00:00Z")) });
    expect((await nextPage(context, "Stripe")).jobs[0]).toMatchObject({ days_open: 94, possible_ghost: true });
});

test("next_jobs pages 25 jobs at a time", async () => {
    const titles = Array.from({ length: 30 }, (_, index) => `Software Engineer ${index}`);
    const page = await nextPage(testContext({ http: fakeBoard(greenhouseBoard(titles)) }), "Stripe");
    expect(page.total_unscored).toBe(30);
    expect(page.jobs).toHaveLength(25);
});

test("next_jobs fetches nothing: sources are fetched before the run's first turn", async () => {
    const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
    const context = testContext({ http });
    expect([(await invokeTool(context, "next_jobs", { source: "Stripe" })) as object, http.urls]).toEqual([{ source: "Stripe", total_unscored: 0, jobs: [] }, []]);
});

test("next_jobs pages a board read once per run", async () => {
    const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
    const context = testContext({ http });
    await nextPage(context, "Stripe");
    await nextPage(context, "Stripe");
    expect(http.urls).toHaveLength(1);
});

test("next_jobs offers a failing source's jobs from earlier runs, and a board's jobs seen in this run's fetch", async () => {
    const earlier = makeJob({ ats: "greenhouse", jobId: "900", company: "Stripe", title: "Platform Engineer", url: "https://x" }, {});
    const failing = testContext({ http: flakyBoard(greenhouseBoard(["Backend Engineer"])) });
    await failing.store.upsertAll([earlier], "2026-10-01T00:00:00.000Z", { id: 1, name: "Stripe" });
    expect((await nextPage(failing, "Stripe")).jobs.map((job) => job.job_id)).toEqual(["900"]);
    const fetched = { ...failing, run: newRunState() };
    expect((await nextPage(fetched, "Stripe")).jobs.map((job) => job.job_id)).toEqual(["1000"]);
});

test("next_jobs rejects an unknown source", async () => {
    await expect(nextPage(testContext(), "Initech")).rejects.toThrow('unknown source "Initech"');
});

test("the run's fetch logs the jobs each board download returned, without descriptions", async () => {
    const jobLog = memoryTrace();
    const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Account Executive"])), jobLog });
    await nextPage(context, "Stripe");
    await nextPage(context, "Stripe");
    expect(jobLog.events).toHaveLength(1);
    expect(jobLog.events[0]).toMatchObject({ type: "source_fetch", source: "Stripe", module: "greenhouse", job_count: 2 });
    expect(jobLog.events[0]?.jobs).toMatchObject([
        { jobId: "1000", title: "Backend Engineer" },
        { jobId: "1001", title: "Account Executive" },
    ]);
    expect(JSON.stringify(jobLog.events[0])).not.toContain("description");
});

test("next_jobs pages every unscored alert job, including ones an earlier run left unscored", async () => {
    const context = await alertContext({}, [alertEmail(10, SEARCH_SENDER, searchAlert(fixtureJobs(2), "senior engineer"))]);
    const earlier = makeJob({ ats: "linkedin", jobId: "li_1", company: "Old Co", title: "Senior Engineer", url: "https://x" }, {});
    await context.store.upsertAll([earlier], "2026-10-01T00:00:00.000Z", ALERTS_REF);
    const page = await nextPage(context, "Gmail alerts");
    expect([page.total_unscored, page.jobs.map((job) => job.job_id).sort()]).toEqual([3, ["li_1", "li_4100000000", "li_4100000001"]]);
    expect(context.run.sources.get("Gmail alerts")?.alerts).toMatchObject({ emails: 1, jobs_found: 2, stored: 2 });
});

test("the run's fetch of Gmail alerts looks up careers pages only for unscored jobs without a description that weren't tried before", async () => {
    const base = await alertContext();
    const jobs = ["li_new", "li_described", "li_tried"].map((jobId) => makeJob({ ats: "linkedin", jobId, company: "Acme", title: "Senior Engineer", url: "https://x" }, { description: jobId === "li_described" ? "Known." : null }));
    await base.store.upsertAll(jobs, "2026-10-01T00:00:00.000Z", ALERTS_REF);
    await base.careers.store.audit({ runId: "old", at: "2026-10-01T00:00:00.000Z", ats: "linkedin", jobId: "li_tried", company: "Acme", step: "finish", url: null, outcome: "failed", reason: "job_not_found" });
    const { chat, requests } = scriptedChat([search(), open(1, "job_page"), finish(true)]);
    const careers = { ...base.careers, searxngUrl: "https://search.example", lookup: publicDns(), pages: fakePages({ [POSTING_URL]: jobPage("Senior Engineer", ["Build APIs."]) }) };
    const context = { ...base, chat, careers, http: fakeBoard(searxngJson([{ url: POSTING_URL, title: "Senior Engineer" }])) };
    await nextPage(context, "Gmail alerts");
    expect(context.run.sources.get("Gmail alerts")?.careers).toMatchObject({ looked_up: 1, found: 1 });
    expect(String(requests[0]?.[1]?.content)).toContain("Senior Engineer at Acme");
    expect(await context.store.findJob("li_new")).toMatchObject({ description_source: "careers", description: expect.stringContaining("Build APIs.") });
});
