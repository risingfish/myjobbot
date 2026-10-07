import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

const SUMMARY = { summary: "done" };

test("finish is refused while a source has not been fetched", async () => {
  const context = testContext();
  expect(await invokeTool(context, "finish", SUMMARY)).toMatchObject({ ok: false, not_done: ["Stripe: not fetched yet"] });
  expect(context.run.finished).toBe(false);
});

test("finish is refused while fetched jobs are still unscored", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"])) });
  await fetchPage(context, "Stripe");
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 30, bonus: 30 }] });
  expect(await invokeTool(context, "finish", SUMMARY)).toMatchObject({ ok: false, not_done: ["Stripe: 1 unscored"] });
});

test("finish ends the run once every source is fetched and scored", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"])) });
  await fetchPage(context, "Stripe");
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: "1000", base: 30, bonus: 30 }] });
  expect(await invokeTool(context, "finish", SUMMARY)).toEqual({ ok: true });
  expect(context.run).toMatchObject({ finished: true, summary: "done" });
});

test("a source whose fetch failed does not block finish", async () => {
  const context = testContext();
  await expect(fetchPage(context, "Stripe")).rejects.toThrow();
  expect(await invokeTool(context, "finish", SUMMARY)).toEqual({ ok: true });
});
