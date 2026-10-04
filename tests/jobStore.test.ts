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
  store.upsertAll([sampleJob("1")], DAY_ONE, "Stripe");
  store.upsertAll([sampleJob("1")], DAY_TWO, "Stripe");
  expect(store.unscoredSince("Stripe", DAY_TWO)).toMatchObject([{ job_id: "1", first_seen: DAY_ONE, last_seen: DAY_TWO }]);
});

test("unscoredSince ignores jobs missing from that fetch", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("1"), sampleJob("2")], DAY_ONE, "Stripe");
  store.upsertAll([sampleJob("2")], DAY_TWO, "Stripe");
  expect(store.unscoredSince("Stripe", DAY_TWO).map((row) => row.job_id)).toEqual(["2"]);
});

test("earliestSeen uses the older of posted_at and first_seen across reposts", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("old")], "2026-06-01T00:00:00.000Z", "Stripe");
  const repost = makeJob({ ats: "greenhouse", jobId: "new", company: "Stripe", title: "Backend Engineer!", url: "u" }, { postedAt: "2026-09-01T00:00:00.000Z" });
  store.upsertAll([repost], DAY_TWO, "Stripe");
  expect(store.earliestSeen("Stripe", "backend engineer")).toBe("2026-06-01T00:00:00.000Z");
});

test("pruneLastSeenBefore deletes stale jobs only", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("1")], DAY_ONE, "Stripe");
  store.upsertAll([sampleJob("2")], DAY_TWO, "Stripe");
  expect(store.pruneLastSeenBefore(DAY_TWO)).toBe(1);
  expect(store.unscoredSince("Stripe", DAY_TWO).map((row) => row.job_id)).toEqual(["2"]);
});
