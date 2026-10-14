import { expect, test } from "vitest";
import { makeClientDir, TEST_ASSET } from "./helpers/clientDir.js";
import { startTestUi } from "./helpers/ui.js";
import { seededViews } from "./helpers/views.js";

test("every page address serves the app, which needs JavaScript", async () => {
  const ui = await startTestUi(seededViews([]));
  for (const path of ["/recommended", "/jobs", "/reasoning", "/settings"]) {
    const response = await ui(path);
    expect([path, response.status, response.headers.get("content-type")]).toEqual([path, 200, "text/html; charset=utf-8"]);
    const html = await response.text();
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain("myjobbot's web UI needs JavaScript.");
  }
});

test("built assets are served with long caching, and nothing outside the assets folder is", async () => {
  const ui = await startTestUi(seededViews([]));
  const asset = await ui(`/assets/${TEST_ASSET}`);
  expect([asset.status, asset.headers.get("content-type")]).toEqual([200, "text/javascript; charset=utf-8"]);
  expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect(await asset.text()).toBe("console.log('app');");
  for (const path of ["/assets/../index.html", "/assets/%2e%2e/package.json", "/assets/..%2Findex.html", "/assets/missing.js", "/assets/"]) {
    expect([path, (await ui(path)).status]).toEqual([path, 404]);
  }
});

test("the server redirects the root, rejects unknown paths and methods", async () => {
  const ui = await startTestUi(seededViews([]));
  const root = await ui("/");
  expect([root.status, root.headers.get("location")]).toEqual([302, "/recommended"]);
  const missing = await ui("/nope");
  expect([missing.status, await missing.text()]).toEqual([404, expect.stringContaining("Not found")]);
  expect((await ui("/jobs", { method: "POST" })).status).toBe(405);
  expect((await ui("/jobs/rows?offset=100")).status).toBe(404);
});

test("a missing app build returns a 500 page and the server keeps answering", async () => {
  const ui = await startTestUi(seededViews([]), undefined, makeClientDir(false));
  const response = await ui("/jobs");
  expect(response.status).toBe(500);
  expect(await response.text()).toContain("Something went wrong");
  expect((await ui("/api/meta")).status).toBe(200);
});
