import { expect, test } from "vitest";
import type { JobRowView, PageData, VerdictRowView } from "../src/web/api.js";
import { testFileConfig } from "./helpers/config.js";
import { TEST_NOW } from "./helpers/context.js";
import { startTestUi, type UiFetch } from "./helpers/ui.js";
import { seededViews, type SeedJob } from "./helpers/views.js";

async function page(ui: UiFetch, path: string): Promise<PageData> {
  const response = await ui(`/api/pages/${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as PageData;
}

function jobRows(data: PageData): JobRowView[] {
  if (data.kind !== "jobs") throw new Error(`expected job rows, got ${data.kind}`);
  return data.rows;
}

function verdictRows(data: PageData): VerdictRowView[] {
  if (data.kind !== "verdicts") throw new Error(`expected verdict rows, got ${data.kind}`);
  return data.rows;
}

function uiWith(jobs: SeedJob[], overrides: Parameters<typeof testFileConfig>[0] = {}) {
  const views = seededViews(jobs);
  const config = testFileConfig(overrides);
  return startTestUi(views, () => ({ config, views, dbPath: "test.db" }));
}

test("recommended holds jobs at or above the threshold, with their reasoning and publisher", async () => {
  const data = await page(await uiWith([{ id: "a", score: 90, publisher: "LinkedIn" }, { id: "b", score: 40 }]), "recommended");
  expect(data.summary).toBe("1 recommended · threshold 70");
  expect(jobRows(data).map((row) => row.title)).toEqual(["Software Engineer a"]);
  expect(jobRows(data)[0]).toMatchObject({ reasons: ["reason a"], gaps: ["gap a"], via: "LinkedIn" });
});

test("title boosts lift a job over the threshold and report the model's own score", async () => {
  const jobs = [{ id: "t", score: 65, title: "Senior TypeScript Engineer" }, { id: "j", score: 65, title: "Senior Java Engineer" }];
  const rows = jobRows(await page(await uiWith(jobs, { title_boosts: { typescript: 10 } }), "recommended"));
  expect(rows.map((row) => row.title)).toEqual(["Senior TypeScript Engineer"]);
  expect(rows[0]?.score).toEqual({ value: 75, note: "model 65 · +10 typescript" });
});

test("excluded companies drop out of recommended and are marked in all jobs", async () => {
  const ui = await uiWith([{ id: "a", score: 90 }], { exclude_companies: ["acme"] });
  const recommended = await page(ui, "recommended");
  expect(recommended).toMatchObject({ total: 0, empty: "No recommendations yet: run myjobbot run." });
  expect(jobRows(await page(ui, "jobs"))[0]?.filterNote).toBe("hidden: excluded company");
});

test("scores carry the base and bonus breakdown, and boosts count matches in the description", async () => {
  const job = { id: "b", score: 62, parts: { base: 32, bonus: 30 }, description: "Vue and TypeScript." };
  const ui = await uiWith([job], { title_boosts: { typescript: 10 } });
  expect(jobRows(await page(ui, "recommended"))[0]?.score).toEqual({ value: 72, note: "base 32 + bonus 30 · model 62 · +10 typescript" });
  expect(verdictRows(await page(ui, "reasoning"))[0]?.score).toEqual({ value: 62, note: "base 32 + bonus 30" });
});

test("all jobs lists every job and marks titles the filter hides", async () => {
  const data = await page(await uiWith([{ id: "a", score: 90 }, { id: "e", title: "Account Executive" }]), "jobs");
  expect(data.summary).toBe("2 jobs");
  expect(jobRows(data).find((row) => row.jobId === "e")?.filterNote).toBe("hidden by title filter");
  expect(jobRows(data).find((row) => row.jobId === "a")?.filterNote).toBeNull();
});

test("only http and https postings carry a link", async () => {
  const rows = jobRows(await page(await uiWith([{ id: "x", url: "javascript:alert(1)" }, { id: "y", url: "https://example.com/y" }]), "jobs"));
  expect(rows.find((row) => row.jobId === "x")?.url).toBeNull();
  expect(rows.find((row) => row.jobId === "y")?.url).toBe("https://example.com/y");
});

test("long-open postings are flagged as possible ghosts", async () => {
  const rows = jobRows(await page(await uiWith([{ id: "g", score: 90, postedAt: "2026-06-01T00:00:00.000Z" }]), "recommended"));
  expect(rows[0]?.posted).toMatchObject({ date: "2026-06-01", ghost: true });
  expect(rows[0]?.posted.daysOpen).toBeGreaterThan(60);
});

test("pages hold 100 rows and say where the next page starts", async () => {
  const ui = await uiWith(Array.from({ length: 250 }, (_, index) => ({ id: String(index).padStart(3, "0") })));
  const slices = [await page(ui, "jobs"), await page(ui, "jobs?offset=100"), await page(ui, "jobs?offset=200")];
  expect(slices.map((data) => [data.rows.length, data.nextOffset, data.total])).toEqual([[100, 100, 250], [100, 200, 250], [50, null, 250]]);
});

test("an invalid offset gives the first page", async () => {
  const ui = await uiWith([{ id: "a" }]);
  for (const offset of ["-5", "abc"]) expect((await page(ui, `jobs?offset=${offset}`)).rows).toHaveLength(1);
});

test("reasoning lists each verdict with its run and scoring time", async () => {
  const data = await page(await uiWith([{ id: "a", score: 80 }]), "reasoning");
  expect(data.summary).toBe("1 scoring decisions");
  expect(verdictRows(data)[0]).toMatchObject({ run: "run-1", scoredAt: "2026-10-02 00:00", title: "Software Engineer a", gaps: ["gap a"] });
});

test("meta reports the database and when the server answered", async () => {
  const response = await (await uiWith([]))("/api/meta");
  expect(await response.json()).toEqual({ dbPath: "test.db", renderedAt: TEST_NOW.toISOString() });
});

test("api responses are uncached JSON, and unknown api addresses are JSON 404s", async () => {
  const ui = await uiWith([]);
  for (const path of ["/api/pages/nope", "/api/other"]) {
    const response = await ui(path);
    expect([response.status, await response.json()]).toEqual([404, { error: "Not found" }]);
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
});

test("a failing load returns a JSON 500 with the message and the server keeps answering", async () => {
  const ui = await startTestUi(seededViews([]), () => { throw new Error("broken <db>"); });
  const response = await ui("/api/pages/jobs");
  expect([response.status, await response.json()]).toEqual([500, { error: "broken <db>" }]);
  expect((await ui("/api/other")).status).toBe(404);
});
