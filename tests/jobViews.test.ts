import { expect, test } from "vitest";
import { FIRST_PAGE, seededViews } from "./helpers/views.js";

const SEED = [
  { id: "a", source: "Search", score: 90, postedAt: "2026-09-28T00:00:00.000Z" },
  { id: "b", source: "Search", score: 60 },
  { id: "c", source: "Board", score: 95, postedAt: "2026-09-20T00:00:00.000Z" },
  { id: "d", source: "Removed", score: 99 },
  { id: "e", source: "Board" },
];

test("recommended keeps configured sources at or above the threshold, newest first", () => {
  const views = seededViews(SEED);
  const filter = { sources: ["Search", "Board"], threshold: 70 };
  expect(views.recommended(filter, FIRST_PAGE).map((job) => job.job_id)).toEqual(["a", "c"]);
  expect(views.countRecommended(filter)).toBe(2);
});

test("recommended with no configured sources is empty", () => {
  expect(seededViews(SEED).recommended({ sources: [], threshold: 0 }, FIRST_PAGE)).toEqual([]);
});

test("allJobs returns every job with parsed reasons and gaps", () => {
  const views = seededViews(SEED);
  expect(views.countAllJobs()).toBe(5);
  expect(views.allJobs(FIRST_PAGE).find((job) => job.job_id === "a")).toMatchObject({ score: 90, reasons: ["reason a"], gaps: ["gap a"] });
  expect(views.allJobs(FIRST_PAGE).find((job) => job.job_id === "e")).toMatchObject({ score: null, reasons: [], gaps: [] });
});

test("allJobs lists the most recently posted first, falling back to first seen", () => {
  const views = seededViews([
    { id: "old", postedAt: "2026-09-01T00:00:00.000Z" },
    { id: "unknown", postedAt: null },
    { id: "new", postedAt: "2026-09-29T00:00:00.000Z" },
  ]);
  expect(views.allJobs(FIRST_PAGE).map((job) => job.job_id)).toEqual(["unknown", "new", "old"]);
});

test("pages are stable slices of the same order", () => {
  const views = seededViews(SEED);
  const all = views.allJobs(FIRST_PAGE).map((job) => job.job_id);
  const sliced = [0, 2, 4].flatMap((offset) => views.allJobs({ offset, limit: 2 }).map((job) => job.job_id));
  expect(sliced).toEqual(all);
});

test("verdictHistory joins each verdict to its job", () => {
  const views = seededViews([{ id: "a", score: 80, title: "Senior Software Engineer" }]);
  expect(views.verdictHistory(FIRST_PAGE)).toMatchObject([
    { run_id: "run-1", score: 80, title: "Senior Software Engineer", company: "Acme", reasons: ["reason a"], gaps: ["gap a"] },
  ]);
  expect(views.countVerdicts()).toBe(1);
});
