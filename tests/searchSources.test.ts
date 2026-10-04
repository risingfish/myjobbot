import { expect, test } from "vitest";
import { newRunState, type ToolContext } from "../src/tools/context.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { TEST_SEARCH, testFileConfig } from "./helpers/config.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { jsearchId } from "./helpers/jsearch.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";
import { memoryTrace } from "./helpers/trace.js";

const JSEARCH_HOST = "api.openwebninja.com";
const SEARCH_NAME = TEST_SEARCH.name;

function searchContext(overrides: Partial<ToolContext> = {}) {
  const http = routedHttp({ [JSEARCH_HOST]: loadFixture("jsearch.json"), "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]) });
  const context = testContext({ config: testFileConfig({ searches: [TEST_SEARCH] }), http, ...overrides });
  const jsearchRequests = () => http.requests.filter((sent) => new URL(sent.url).host === JSEARCH_HOST);
  return { context, jsearchRequests };
}

test("fetch_jobs on a search calls JSearch once per run and serves its jobs", async () => {
  const { context, jsearchRequests } = searchContext();
  expect(await fetchPage(context, SEARCH_NAME)).toMatchObject({ source: SEARCH_NAME, total_unscored: 2, refreshed: true });
  await fetchPage(context, SEARCH_NAME);
  expect(jsearchRequests()).toHaveLength(1);
});

test("a search is not refreshed again within refresh_hours", async () => {
  const { context, jsearchRequests } = searchContext();
  await fetchPage(context, SEARCH_NAME);
  const page = await fetchPage({ ...context, run: newRunState() }, SEARCH_NAME);
  expect(page).toMatchObject({ total_unscored: 2, refreshed: false, refresh_note: "refreshed 0h ago; next refresh in 24h" });
  expect(jsearchRequests()).toHaveLength(1);
});

test("a search is not refreshed once the monthly budget is used", async () => {
  const { context, jsearchRequests } = searchContext();
  for (let index = 0; index < 190; index += 1) context.apiCalls.record("jsearch", "other", TEST_NOW.toISOString());
  const page = await fetchPage(context, SEARCH_NAME);
  expect(page).toMatchObject({ total_unscored: 0, refreshed: false, refresh_note: "monthly JSearch budget used (190/190)" });
  expect(jsearchRequests()).toHaveLength(0);
});

test("JSearch results that duplicate a company-board job are skipped", async () => {
  const { context } = searchContext();
  await fetchPage(context, "Stripe");
  expect((await fetchPage(context, SEARCH_NAME)).jobs.map((job) => job.job_id)).toEqual([jsearchId("js-linkedin-1")]);
});

test("each JSearch request is logged with its query and skipped duplicates", async () => {
  const jobLog = memoryTrace();
  const { context } = searchContext({ jobLog });
  await fetchPage(context, "Stripe");
  await fetchPage(context, SEARCH_NAME);
  expect(jobLog.events.at(-1)).toMatchObject({
    type: "search_fetch", source: SEARCH_NAME, query: "senior backend engineer", requests_this_month: 1,
    job_count: 1, skipped_duplicates: 1, params: { country: "us", date_posted: "3days", work_from_home: "true" },
  });
});

test("list_sources shows saved searches next to boards", async () => {
  const { context } = searchContext();
  await fetchPage(context, SEARCH_NAME);
  expect(await invokeTool(context, "list_sources", {})).toEqual([
    { name: "Stripe", kind: "board", ats: "greenhouse", fetched: false },
    { name: SEARCH_NAME, kind: "search", fetched: true, total_unscored: 2 },
  ]);
});
