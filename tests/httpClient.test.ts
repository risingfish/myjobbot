import { expect, test } from "vitest";
import { HttpClient } from "../src/http/client.js";
import { testFileConfig } from "./helpers/config.js";
import { jsonResponse, scriptedFetch } from "./helpers/http.js";

test("HttpClient returns parsed JSON", async () => {
  const { fetchFn } = scriptedFetch([jsonResponse({ jobs: [] })]);
  const client = new HttpClient(testFileConfig().http, fetchFn);
  expect(await client.getJson("https://example.com/board")).toEqual({ jobs: [] });
});

test("HttpClient throws on a non-2xx response", async () => {
  const { fetchFn } = scriptedFetch([jsonResponse({}, 404)]);
  const client = new HttpClient(testFileConfig().http, fetchFn);
  await expect(client.getJson("https://example.com/board")).rejects.toThrow("HTTP 404");
});
