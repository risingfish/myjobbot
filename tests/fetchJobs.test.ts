import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage } from "./helpers/tools.js";

test("fetch_jobs returns title-filtered unscored jobs without null fields", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Account Executive"])) });
  expect(await fetchPage(context, "stripe")).toEqual({
    company: "Stripe",
    total_unscored: 1,
    jobs: [{ job_id: "1000", title: "Backend Engineer", location: "Remote", posted_at: "2026-09-01T00:00:00.000Z" }],
  });
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

test("fetch_jobs rejects an unknown company", async () => {
  await expect(fetchPage(testContext(), "Initech")).rejects.toThrow('unknown company "Initech"');
});
