import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard, flakyBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

const UNFETCHED = { name: "Stripe", kind: "board", ats: "greenhouse", fetched: false };

function failingBoard() {
  return { getJson: () => Promise.reject(new Error("down")) };
}

test("list_sources returns each board with its kind, board type, and run progress", async () => {
  expect(await invokeTool(testContext(), "list_sources", {})).toEqual([UNFETCHED]);
});

test("list_sources flags fetch_failed when the cached fetch rejected", async () => {
  const context = testContext({ http: failingBoard() });
  await expect(invokeTool(context, "fetch_jobs", { source: "Stripe" })).rejects.toThrow();
  expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetch_failed: true }]);
});

test("list_sources clears fetch_failed once a retry succeeds", async () => {
  const context = testContext({ http: flakyBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
  await expect(invokeTool(context, "fetch_jobs", { source: "Stripe" })).rejects.toThrow();
  await invokeTool(context, "fetch_jobs", { source: "Stripe" });
  expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetched: true, total_unscored: 2 }]);
  context.run.fetches.delete("Stripe");
  expect(await invokeTool(context, "list_sources", {})).toEqual([UNFETCHED]);
});

test("list_sources reports total_unscored once a board has been fetched", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
  const page = await fetchPage(context, "Stripe");
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: page.jobs[0]?.job_id, score: 80 }] });
  expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetched: true, total_unscored: 1 }]);
});
