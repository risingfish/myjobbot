import { expect, test } from "vitest";
import { HttpClient } from "../src/http/client.js";
import { fakeClock } from "./helpers/clock.js";
import { testFileConfig } from "./helpers/config.js";
import { jsonResponse, scriptedFetch } from "./helpers/http.js";

const URL_A = "https://a.example/board";

function client(responses: Response[]) {
  const clock = fakeClock();
  const { fetchFn, urls } = scriptedFetch(responses);
  const http = new HttpClient({ config: testFileConfig().http, clock, fetchFn, random: () => 0 });
  return { http, clock, urls };
}

test("HttpClient returns parsed JSON", async () => {
  const { http } = client([jsonResponse({ jobs: [] })]);
  expect(await http.getJson(URL_A)).toEqual({ jobs: [] });
});

test("HttpClient retries a 503 with exponential backoff", async () => {
  const { http, clock, urls } = client([jsonResponse({}, 503), jsonResponse({ ok: true })]);
  expect(await http.getJson(URL_A)).toEqual({ ok: true });
  expect(urls).toHaveLength(2);
  expect(clock.sleeps).toEqual([1000]);
});

test("HttpClient honors Retry-After, capped at max_retry_after_s", async () => {
  const { http, clock } = client([
    jsonResponse({}, 429, { "retry-after": "7" }),
    jsonResponse({}, 429, { "retry-after": "999" }),
    jsonResponse({ ok: true }),
  ]);
  await http.getJson(URL_A);
  expect(clock.sleeps).toEqual([7000, 60_000]);
});

test("HttpClient gives up after max_retries", async () => {
  const { http, urls } = client([jsonResponse({}, 503), jsonResponse({}, 503), jsonResponse({}, 503)]);
  await expect(http.getJson(URL_A)).rejects.toThrow("HTTP 503");
  expect(urls).toHaveLength(3);
});

test("HttpClient does not retry a 404", async () => {
  const { http, urls } = client([jsonResponse({}, 404)]);
  await expect(http.getJson(URL_A)).rejects.toThrow("HTTP 404");
  expect(urls).toHaveLength(1);
});
