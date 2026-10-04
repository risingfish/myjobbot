import { expect, test } from "vitest";
import { fetchJsearch } from "../src/sources/jsearch.js";
import { TEST_SEARCH, testFileConfig } from "./helpers/config.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { jsearchId } from "./helpers/jsearch.js";

const HOST = "api.openwebninja.com";

function request(overrides: object = {}) {
  const config = testFileConfig({ searches: [{ ...TEST_SEARCH, ...overrides }] });
  const search = config.searches[0];
  if (!search) throw new Error("test search missing");
  return { search, settings: config.jsearch, apiKey: "secret-key" };
}

test("fetchJsearch requests the search with the API key header", async () => {
  const http = routedHttp({ [HOST]: loadFixture("jsearch.json") });
  await fetchJsearch(request(), http);
  expect(http.requests[0]?.headers).toEqual({ "x-api-key": "secret-key" });
  const url = new URL(http.requests[0]?.url ?? "");
  expect(`${url.origin}${url.pathname}`).toBe("https://api.openwebninja.com/jsearch/search-v2");
  expect(Object.fromEntries(url.searchParams)).toEqual({ query: "senior backend engineer", country: "us", date_posted: "3days", work_from_home: "true" });
});

test("fetchJsearch omits work_from_home unless the search is remote-only", async () => {
  const http = routedHttp({ [HOST]: loadFixture("jsearch.json") });
  await fetchJsearch(request({ remote_only: false }), http);
  expect(new URL(http.requests[0]?.url ?? "").searchParams.has("work_from_home")).toBe(false);
});

test("fetchJsearch maps results to jobs", async () => {
  const jobs = await fetchJsearch(request(), routedHttp({ [HOST]: loadFixture("jsearch.json") }));
  expect(jobs[0]).toMatchObject({
    ats: "jsearch", jobId: jsearchId("js-linkedin-1"), company: "Acme Robotics, Inc.", title: "Senior Backend Engineer",
    url: "https://www.linkedin.com/jobs/view/1", location: "Austin, TX, US", isRemote: true, workplaceType: "remote",
    compensation: "$170K-$210K a year", postedAt: "2026-10-02T15:00:00.000Z", publisher: "LinkedIn",
  });
  expect(jobs[1]).toMatchObject({ location: "US", isRemote: false, workplaceType: null, publisher: "Stripe Careers" });
});

test("fetchJsearch shortens JSearch's long job ids to stable short ids", async () => {
  const rawId = "x".repeat(402);
  const job = { job_id: rawId, employer_name: "Long Id Co", job_title: "Backend Engineer", job_apply_link: "https://example.com/l" };
  const body = { data: { jobs: [job] } };
  const first = await fetchJsearch(request(), routedHttp({ [HOST]: body }));
  const second = await fetchJsearch(request(), routedHttp({ [HOST]: body }));
  expect(first[0]?.jobId).toMatch(/^js_[0-9a-f]{16}$/);
  expect(second[0]?.jobId).toBe(first[0]?.jobId);
});

test("fetchJsearch explains a refused request", async () => {
  const http = { getJson: () => Promise.reject(new Error("GET https://api.openwebninja.com/jsearch/search-v2?query=x failed with HTTP 401")) };
  await expect(fetchJsearch(request(), http)).rejects.toThrow("JSearch refused the request (HTTP 401); check JSEARCH_API_KEY and that the account is subscribed to JSearch");
});
