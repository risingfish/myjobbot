import { expect, test } from "vitest";
import type { JobRowView, PageData, PageName, VerdictRowView } from "../src/web/api.js";
import { loadPageData } from "../src/web/pageData.js";
import { testFileConfig } from "./helpers/config.js";
import { TEST_NOW } from "./helpers/context.js";
import { seededViews, type SeedJob } from "./helpers/views.js";

function pagesOf(jobs: SeedJob[], overrides: Parameters<typeof testFileConfig>[0] = {}) {
  const input = { views: seededViews(jobs), config: testFileConfig(overrides), now: TEST_NOW };
  return (name: PageName, offset = 0) => loadPageData(name, { ...input, page: { offset, limit: 100 } });
}

function jobRows(data: PageData): JobRowView[] {
  if (data.kind !== "jobs") throw new Error(`expected job rows, got ${data.kind}`);
  return data.rows;
}

function verdictRows(data: PageData): VerdictRowView[] {
  if (data.kind !== "verdicts") throw new Error(`expected verdict rows, got ${data.kind}`);
  return data.rows;
}

test("recommended holds jobs at or above the threshold, with their reasoning and publisher", () => {
  const data = pagesOf([{ id: "a", score: 90, publisher: "LinkedIn" }, { id: "b", score: 40 }])("recommended");
  expect(data.summary).toBe("1 recommended · threshold 70");
  expect(jobRows(data).map((row) => row.title)).toEqual(["Software Engineer a"]);
  expect(jobRows(data)[0]).toMatchObject({ reasons: ["reason a"], gaps: ["gap a"], via: "LinkedIn" });
});

test("title boosts lift a job over the threshold and report the model's own score", () => {
  const jobs = [{ id: "t", score: 65, title: "Senior TypeScript Engineer" }, { id: "j", score: 65, title: "Senior Java Engineer" }];
  const rows = jobRows(pagesOf(jobs, { title_boosts: { typescript: 10 } })("recommended"));
  expect(rows.map((row) => row.title)).toEqual(["Senior TypeScript Engineer"]);
  expect(rows[0]?.score).toEqual({ value: 75, note: "model 65 · +10 typescript" });
});

test("excluded companies drop out of recommended and are marked in all jobs", () => {
  const page = pagesOf([{ id: "a", score: 90 }], { exclude_companies: ["acme"] });
  expect(page("recommended")).toMatchObject({ total: 0, empty: "No recommendations yet: run myjobbot run." });
  expect(jobRows(page("jobs"))[0]?.filterNote).toBe("hidden: excluded company");
});

test("scores carry the base and bonus breakdown, and boosts count matches in the description", () => {
  const job = { id: "b", score: 62, parts: { base: 32, bonus: 30 }, description: "Vue and TypeScript." };
  const page = pagesOf([job], { title_boosts: { typescript: 10 } });
  expect(jobRows(page("recommended"))[0]?.score).toEqual({ value: 72, note: "base 32 + bonus 30 · model 62 · +10 typescript" });
  expect(verdictRows(page("reasoning"))[0]?.score).toEqual({ value: 62, note: "base 32 + bonus 30" });
});

test("all jobs lists every job and marks titles the filter hides", () => {
  const data = pagesOf([{ id: "a", score: 90 }, { id: "e", title: "Account Executive" }])("jobs");
  expect(data.summary).toBe("2 jobs");
  expect(jobRows(data).find((row) => row.jobId === "e")?.filterNote).toBe("hidden by title filter");
  expect(jobRows(data).find((row) => row.jobId === "a")?.filterNote).toBeNull();
});

test("only http and https postings carry a link", () => {
  const rows = jobRows(pagesOf([{ id: "x", url: "javascript:alert(1)" }, { id: "y", url: "https://example.com/y" }])("jobs"));
  expect(rows.find((row) => row.jobId === "x")?.url).toBeNull();
  expect(rows.find((row) => row.jobId === "y")?.url).toBe("https://example.com/y");
});

test("long-open postings are flagged as possible ghosts", () => {
  const rows = jobRows(pagesOf([{ id: "g", score: 90, postedAt: "2026-06-01T00:00:00.000Z" }])("recommended"));
  expect(rows[0]?.posted).toMatchObject({ date: "2026-06-01", ghost: true });
  expect(rows[0]?.posted.daysOpen).toBeGreaterThan(60);
});

test("pages hold 100 rows and say where the next page starts", () => {
  const page = pagesOf(Array.from({ length: 250 }, (_, index) => ({ id: String(index).padStart(3, "0") })));
  const slices = [page("jobs"), page("jobs", 100), page("jobs", 200)];
  expect(slices.map((data) => [data.rows.length, data.nextOffset, data.total])).toEqual([[100, 100, 250], [100, 200, 250], [50, null, 250]]);
});

test("reasoning lists each verdict with its run and scoring time", () => {
  const data = pagesOf([{ id: "a", score: 80 }])("reasoning");
  expect(data.summary).toBe("1 scoring decisions");
  expect(verdictRows(data)[0]).toMatchObject({ run: "run-1", scoredAt: "2026-10-02 00:00", title: "Software Engineer a", gaps: ["gap a"] });
});
