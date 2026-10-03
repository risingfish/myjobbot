import { expect, test } from "vitest";
import { JobStore } from "../src/db/jobStore.js";
import { openDatabase } from "../src/db/open.js";
import { makeJob } from "../src/jobs/job.js";

const DAY_ONE = "2026-10-01T00:00:00.000Z";
const DAY_TWO = "2026-10-02T00:00:00.000Z";

function sampleJob(jobId: string, title = "Backend Engineer") {
  return makeJob({ ats: "greenhouse", jobId, company: "Stripe", title, url: `https://example.com/${jobId}` }, {});
}

test("upsertAll keeps first_seen and advances last_seen", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("1")], DAY_ONE);
  store.upsertAll([sampleJob("1")], DAY_TWO);
  expect(store.unscoredSince("Stripe", DAY_TWO)).toMatchObject([{ job_id: "1", first_seen: DAY_ONE, last_seen: DAY_TWO }]);
});

test("unscoredSince ignores jobs missing from that fetch", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("1"), sampleJob("2")], DAY_ONE);
  store.upsertAll([sampleJob("2")], DAY_TWO);
  expect(store.unscoredSince("Stripe", DAY_TWO).map((row) => row.job_id)).toEqual(["2"]);
});
