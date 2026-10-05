import { expect, test } from "vitest";
import { verdictRow } from "../src/web/rows.js";
import { countRows, pageText, startTestUi } from "./helpers/ui.js";
import { testFileConfig } from "./helpers/config.js";
import { seededViews } from "./helpers/views.js";

test("the recommended tab lists jobs at or above the threshold with their reasoning", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 90, publisher: "LinkedIn" }, { id: "b", score: 40 }]));
  const html = await pageText(ui, "/recommended");
  expect(html).toContain("Software Engineer a");
  expect(html).toContain("via LinkedIn");
  expect(html).toContain("reason a");
  expect(html).not.toContain("Software Engineer b");
  expect(html).toContain("1 recommended · threshold 70");
});

test("title boosts lift a job over the threshold and show the model's own score", async () => {
  const views = seededViews([{ id: "t", score: 65, title: "Senior TypeScript Engineer" }, { id: "j", score: 65, title: "Senior Java Engineer" }]);
  const config = testFileConfig({ title_boosts: { typescript: 10 } });
  const ui = await startTestUi(views, () => ({ config, views, dbPath: "test.db" }));
  const html = await pageText(ui, "/recommended");
  expect(html).toContain("Senior TypeScript Engineer");
  expect(html).not.toContain("Senior Java Engineer");
  expect(html).toContain("model 65 · +10 typescript");
  expect(html).toContain("1 recommended · threshold 70");
});

test("excluded companies drop out of recommended and are marked in all jobs", async () => {
  const views = seededViews([{ id: "a", score: 90 }]);
  const config = testFileConfig({ exclude_companies: ["acme"] });
  const ui = await startTestUi(views, () => ({ config, views, dbPath: "test.db" }));
  expect(await pageText(ui, "/recommended")).toContain("No recommendations yet");
  expect(await pageText(ui, "/jobs")).toContain("hidden: excluded company");
});

test("the all jobs tab lists every job and marks titles the filter hides", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 90 }, { id: "e", title: "Account Executive" }]));
  const html = await pageText(ui, "/jobs");
  expect(countRows(html, "job")).toBe(2);
  expect(html).toContain("hidden by title filter");
  expect(html).toContain("2 jobs");
});

test("job text from the outside world is escaped", async () => {
  const ui = await startTestUi(seededViews([{ id: "x", score: 90, title: "<script>alert(1)</script>" }]));
  const html = await pageText(ui, "/recommended");
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("only http and https postings become links", async () => {
  const ui = await startTestUi(seededViews([{ id: "x", score: 90, url: "javascript:alert(1)" }]));
  expect(await pageText(ui, "/recommended")).not.toContain('href="javascript:');
});

test("long-open postings are flagged as possible ghosts", async () => {
  const ui = await startTestUi(seededViews([{ id: "g", score: 90, postedAt: "2026-06-01T00:00:00.000Z" }]));
  expect(await pageText(ui, "/recommended")).toContain("possible ghost");
});

test("tabs show 100 rows and load the rest 100 at a time", async () => {
  const ids = Array.from({ length: 250 }, (_, index) => ({ id: String(index).padStart(3, "0") }));
  const ui = await startTestUi(seededViews(ids));
  const first = await pageText(ui, "/jobs");
  expect(countRows(first, "job")).toBe(100);
  expect(first).toContain('data-rows="/jobs/rows?offset=100"');
  const last = await pageText(ui, "/jobs/rows?offset=200");
  expect(countRows(last, "job")).toBe(50);
  expect(last).not.toContain("Load more");
});

test("an invalid offset shows the first page", async () => {
  const ui = await startTestUi(seededViews([{ id: "a" }]));
  expect(countRows(await pageText(ui, "/jobs?offset=abc"), "job")).toBe(1);
});

test("an empty tab says so", async () => {
  const ui = await startTestUi(seededViews([]));
  expect(await pageText(ui, "/recommended")).toContain("No recommendations yet");
});

test("the reasoning tab lists each verdict with its run", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 80 }]));
  const html = await pageText(ui, "/reasoning");
  expect(countRows(html, "verdict")).toBe(1);
  expect(html).toContain("run-1");
  expect(html).toContain("gap a");
});

test("verdicts from before history was kept are labelled", () => {
  const verdict = { run_id: null, scored_at: "2026-10-01T00:00:00.000Z", score: 70, reasons: [], gaps: [], title: null, company: null, url: null, source: null };
  const html = verdictRow(verdict);
  expect(html).toContain("before history");
  expect(html).toContain("(pruned)");
});

test("the server redirects the root, rejects unknown paths and methods", async () => {
  const ui = await startTestUi(seededViews([]));
  const root = await ui("/");
  expect([root.status, root.headers.get("location")]).toEqual([302, "/recommended"]);
  expect((await ui("/nope")).status).toBe(404);
  expect((await ui("/jobs", { method: "POST" })).status).toBe(405);
});

test("a failing page returns 500 with an escaped message and the server keeps running", async () => {
  const views = seededViews([]);
  const ui = await startTestUi(views, () => { throw new Error("broken <db>"); });
  const response = await ui("/jobs");
  expect(response.status).toBe(500);
  expect(await response.text()).toContain("broken &lt;db&gt;");
  expect((await ui("/nope")).status).toBe(404);
});
