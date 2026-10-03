import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

test("list_companies returns each company's name, board type, and run progress", async () => {
  const result = await invokeTool(testContext(), "list_companies", {});
  expect(result).toEqual([{ name: "Stripe", ats: "greenhouse", fetched: false }]);
});

test("list_companies reports total_unscored once a company has been fetched", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
  const page = await fetchPage(context, "Stripe");
  const jobId = page.jobs[0]?.job_id;
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: jobId, score: 80 }] });
  const result = await invokeTool(context, "list_companies", {});
  expect(result).toEqual([{ name: "Stripe", ats: "greenhouse", fetched: true, total_unscored: 1 }]);
});
