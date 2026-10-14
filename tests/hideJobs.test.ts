import { expect, test } from "vitest";
import { JobStore } from "../src/db/jobStore.js";
import { JobViews } from "../src/db/jobViews.js";
import { openDatabase } from "../src/db/open.js";
import { makeJob } from "../src/jobs/job.js";
import { FIRST_PAGE } from "./helpers/views.js";

test("a hidden job stays hidden when the same posting is fetched again", () => {
  const db = openDatabase(":memory:");
  const store = new JobStore(db);
  const views = new JobViews(db);
  const job = makeJob({ ats: "greenhouse", jobId: "a", company: "Acme", title: "Software Engineer", url: "u" }, {});
  store.upsertAll([job], "2026-10-01T00:00:00.000Z", "Stripe");
  expect(views.setHidden({ ats: "greenhouse", jobId: "a", hidden: true })).toBe(true);
  store.upsertAll([job], "2026-10-02T00:00:00.000Z", "Stripe");
  expect(views.allJobs(FIRST_PAGE)[0]?.hidden).toBe(true);
});
