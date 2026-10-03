import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

test("get_job_details returns stored metadata and marks descriptions unavailable", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"])) });
  await fetchPage(context, "Stripe");
  expect(await invokeTool(context, "get_job_details", { job_id: "1000" })).toMatchObject({
    job_id: "1000",
    title: "Backend Engineer",
    full_description: "not_available_in_v1",
  });
});

test("get_job_details rejects an unknown job id", async () => {
  await expect(invokeTool(testContext(), "get_job_details", { job_id: "nope" })).rejects.toThrow('unknown job_id "nope"');
});
