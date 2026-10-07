import { expect, test } from "vitest";
import { JobViews } from "../src/db/jobViews.js";
import { openDatabase } from "../src/db/open.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

function boardContext() {
  return testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"])) });
}

test("record_matches scores jobs so fetch_jobs stops offering them", async () => {
  const context = boardContext();
  await fetchPage(context, "Stripe");
  const verdicts = [{ job_id: "1000", base: 50, bonus: 35, reasons: ["Go backend"], gaps: [] }];
  expect(await invokeTool(context, "record_matches", { verdicts })).toEqual({ recorded: 1, unknown_job_ids: [] });
  expect((await fetchPage(context, "Stripe")).jobs.map((job) => job.job_id)).toEqual(["1001"]);
});

test("record_matches reports unknown job ids", async () => {
  const result = await invokeTool(boardContext(), "record_matches", { verdicts: [{ job_id: "nope", base: 10, bonus: 0 }] });
  expect(result).toEqual({ recorded: 0, unknown_job_ids: ["nope"] });
});

test("record_matches accepts numeric job ids", async () => {
  const context = boardContext();
  await fetchPage(context, "Stripe");
  expect(await invokeTool(context, "record_matches", { verdicts: [{ job_id: 1000, base: 5, bonus: 0 }] })).toMatchObject({ recorded: 1 });
});

test("record_matches rejects a base or bonus outside 0-50", async () => {
  await expect(invokeTool(boardContext(), "record_matches", { verdicts: [{ job_id: "1000", base: 60, bonus: 0 }] })).rejects.toThrow();
  await expect(invokeTool(boardContext(), "record_matches", { verdicts: [{ job_id: "1000", base: 40, bonus: 51 }] })).rejects.toThrow();
});

test("record_matches requires the base and bonus, not a single score", async () => {
  await expect(invokeTool(boardContext(), "record_matches", { verdicts: [{ job_id: "1000", score: 80 }] })).rejects.toThrow(/base/);
});

test("record_matches stores the sum as the score and keeps the breakdown", async () => {
  const db = openDatabase(":memory:");
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"])) }, db);
  await fetchPage(context, "Stripe");
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 38, bonus: 40 }] });
  const views = new JobViews(db);
  expect(views.allJobs({ offset: 0, limit: 10 })[0]).toMatchObject({ score: 78, base_score: 38, bonus_score: 40 });
  expect(views.verdictHistory({ offset: 0, limit: 10 })[0]).toMatchObject({ score: 78, base_score: 38, bonus_score: 40 });
});
