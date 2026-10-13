import { expect, test } from "vitest";
import { JobStore } from "../src/db/jobStore.js";
import { JobViews } from "../src/db/jobViews.js";
import { openDatabase } from "../src/db/open.js";
import { makeJob } from "../src/jobs/job.js";
import type { JobRowView, PageData } from "../src/web/api.js";
import { startTestUi, type UiFetch } from "./helpers/ui.js";
import { FIRST_PAGE, seededViews } from "./helpers/views.js";

async function jobRows(ui: UiFetch, name: string): Promise<JobRowView[]> {
  const data = (await (await ui(`/api/pages/${name}`)).json()) as PageData;
  return data.kind === "jobs" ? data.rows : [];
}

function hide(ui: UiFetch, fields: Record<string, string>, headers: Record<string, string> = {}) {
  const body = new URLSearchParams({ ats: "greenhouse", job_id: "a", hidden: "1", back: "/recommended", ...fields });
  return ui("/hide", { method: "POST", body, headers });
}

test("hiding a job removes it from recommended and marks it in all jobs", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 90 }]));
  const response = await hide(ui, {});
  expect([response.status, response.headers.get("location")]).toEqual([303, "/recommended"]);
  expect(await jobRows(ui, "recommended")).toEqual([]);
  expect((await jobRows(ui, "jobs")).map((job) => [job.jobId, job.hidden])).toEqual([["a", true]]);
});

test("unhiding a job brings it back to recommended", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 90 }]));
  await hide(ui, {});
  await hide(ui, { hidden: "0", back: "/jobs" });
  expect((await jobRows(ui, "recommended")).map((job) => job.jobId)).toEqual(["a"]);
});

test("script requests get an empty 204 instead of a redirect", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 90 }]));
  expect((await hide(ui, {}, { "x-myjobbot-fetch": "1" })).status).toBe(204);
});

test("hide rejects other sites, unknown jobs and malformed forms", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 90 }]));
  expect((await hide(ui, {}, { origin: "https://evil.example" })).status).toBe(403);
  expect((await hide(ui, { job_id: "missing" })).status).toBe(404);
  expect((await hide(ui, { hidden: "yes" })).status).toBe(400);
  expect((await jobRows(ui, "recommended")).map((job) => job.jobId)).toEqual(["a"]);
});

test("an unknown back path redirects to recommended", async () => {
  const ui = await startTestUi(seededViews([{ id: "a", score: 90 }]));
  expect((await hide(ui, { back: "https://evil.example" })).headers.get("location")).toBe("/recommended");
});

test("a hidden job stays hidden when the same posting is fetched again", () => {
  const db = openDatabase(":memory:");
  const store = new JobStore(db);
  const views = new JobViews(db);
  const job = makeJob({ ats: "greenhouse", jobId: "a", company: "Acme", title: "Software Engineer", url: "u" }, {});
  store.upsertAll([job], "2026-10-01T00:00:00.000Z", "Stripe");
  expect(views.setHidden({ ats: "greenhouse", jobId: "a", hidden: true })).toBe(true);
  store.upsertAll([job], "2026-10-02T00:00:00.000Z", "Stripe");
  expect(views.allJobs(FIRST_PAGE)[0]?.hidden).toBe(true);
});
