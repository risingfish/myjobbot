import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard, flakyBoard } from "./helpers/http.js";
import { fetchPage } from "./helpers/tools.js";
import { memoryTrace } from "./helpers/trace.js";

test("fetch_jobs returns title-filtered unscored jobs without null fields", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Account Executive"])) });
  expect(await fetchPage(context, "stripe")).toEqual({
    source: "Stripe",
    total_unscored: 1,
    jobs: [{ job_id: "1000", title: "Backend Engineer", location: "Remote", posted_at: "2026-09-01T00:00:00.000Z", days_open: 32, possible_ghost: false }],
  });
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
  expect(jobLog.events[0]?.jobs).toMatchObject([{ jobId: "1000", title: "Backend Engineer" }, { jobId: "1001", title: "Account Executive" }]);
  expect(JSON.stringify(jobLog.events[0])).not.toContain("description");
});
