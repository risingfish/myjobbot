import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { JobStore } from "../src/db/jobStore.js";
import { JobViews } from "../src/db/jobViews.js";
import { openDatabase } from "../src/db/open.js";
import { makeJob } from "../src/jobs/job.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";
import { FIRST_PAGE } from "./helpers/views.js";

function scoredContext() {
  const db = openDatabase(":memory:");
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"])) }, db);
  return { context, views: new JobViews(db) };
}

test("record_matches keeps every verdict as history tagged with the run", async () => {
  const { context, views } = scoredContext();
  await fetchPage(context, "Stripe");
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", score: 60, reasons: ["first"] }] });
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", score: 85, reasons: ["second"] }] });
  const history = views.verdictHistory(FIRST_PAGE).map((verdict) => [verdict.run_id, verdict.score, verdict.reasons]);
  expect(history).toEqual([["test-run", 85, ["second"]], ["test-run", 60, ["first"]]]);
  expect(views.allJobs(FIRST_PAGE).find((job) => job.job_id === "1000")).toMatchObject({ score: 85, reasons: ["second"] });
});

test("record_matches writes no history for unknown job ids", async () => {
  const { context, views } = scoredContext();
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: "nope", score: 60 }] });
  expect(views.countVerdicts()).toBe(0);
});

test("pruning a job removes its verdict history", async () => {
  const { context, views } = scoredContext();
  await fetchPage(context, "Stripe");
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", score: 60 }] });
  context.store.pruneLastSeenBefore("2099-01-01T00:00:00.000Z");
  expect(views.countVerdicts()).toBe(0);
});

test("openDatabase backfills verdict history from already-scored jobs", () => {
  const path = join(mkdtempSync(join(tmpdir(), "myjobbot-db-")), "jobs.db");
  const db = openDatabase(path);
  const job = makeJob({ ats: "lever", jobId: "old-1", company: "Acme", title: "Backend Engineer", url: "https://example.com/1" }, {});
  new JobStore(db).upsertAll([job], "2026-10-01T00:00:00.000Z", "Acme");
  db.exec(`UPDATE jobs SET score = 70, reasons = '["fits"]', gaps = '[]', scored_at = '2026-10-01T01:00:00.000Z'`);
  db.close();
  const history = new JobViews(openDatabase(path)).verdictHistory(FIRST_PAGE);
  expect(history).toMatchObject([{ run_id: null, score: 70, reasons: ["fits"], gaps: [], title: "Backend Engineer" }]);
});
