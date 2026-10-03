import { expect, test } from "vitest";
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
  const verdicts = [{ job_id: "1000", score: 85, reasons: ["Go backend"], gaps: [] }];
  expect(await invokeTool(context, "record_matches", { verdicts })).toEqual({ recorded: 1, unknown_job_ids: [] });
  expect((await fetchPage(context, "Stripe")).jobs.map((job) => job.job_id)).toEqual(["1001"]);
});

test("record_matches reports unknown job ids", async () => {
  const result = await invokeTool(boardContext(), "record_matches", { verdicts: [{ job_id: "nope", score: 10 }] });
  expect(result).toEqual({ recorded: 0, unknown_job_ids: ["nope"] });
});

test("record_matches accepts numeric job ids", async () => {
  const context = boardContext();
  await fetchPage(context, "Stripe");
  expect(await invokeTool(context, "record_matches", { verdicts: [{ job_id: 1000, score: 5 }] })).toMatchObject({ recorded: 1 });
});

test("record_matches rejects out-of-range scores", async () => {
  const verdicts = [{ job_id: "1000", score: 140 }];
  await expect(invokeTool(boardContext(), "record_matches", { verdicts })).rejects.toThrow();
});
