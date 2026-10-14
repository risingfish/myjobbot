import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { RowsPage } from "../../src/web/client/components/pages/RowsPage.js";
import { jsonResponse, stubFetch } from "../helpers/fetchStub.js";
import { jobPage, jobRowView, verdictPage, verdictRowView } from "../helpers/rowFixtures.js";

const JOB_HEADERS = ["Score", "Title", "Company", "Location", "Remote", "Source", "Posted", "Scored", ""];
const VERDICT_HEADERS = ["Scored at", "Run", "Job", "Company", "Score", "Reasons", "Gaps"];

function headers(container: HTMLElement): string[] {
  return [...container.querySelectorAll("th")].map((cell) => cell.textContent ?? "");
}

test("a page of jobs shows its summary and a table of rows", async () => {
  stubFetch({ "/api/pages/jobs": () => jsonResponse(jobPage([jobRowView()], { summary: "1 jobs" })) });
  const { container } = render(<RowsPage name="jobs" />);
  expect(await screen.findByText("1 jobs")).toBeTruthy();
  expect(headers(container)).toEqual(JOB_HEADERS);
  expect(container.querySelectorAll("tr.job")).toHaveLength(1);
});

test("the reasoning page shows verdict columns", async () => {
  stubFetch({ "/api/pages/reasoning": () => jsonResponse(verdictPage([verdictRowView()])) });
  const { container } = render(<RowsPage name="reasoning" />);
  expect(await screen.findByText("1 scoring decisions")).toBeTruthy();
  expect(headers(container)).toEqual(VERDICT_HEADERS);
  expect(container.querySelectorAll("tr.verdict")).toHaveLength(1);
});

test("an empty page says so and shows no table", async () => {
  stubFetch({ "/api/pages/recommended": () => jsonResponse(jobPage([], { summary: "0 recommended · threshold 70", empty: "No recommendations yet: run myjobbot run." })) });
  const { container } = render(<RowsPage name="recommended" />);
  expect(await screen.findByText("No recommendations yet: run myjobbot run.")).toBeTruthy();
  expect(container.querySelector("table")).toBeNull();
});

test("a failed load shows the server's message where the rows would be", async () => {
  stubFetch({ "/api/pages/jobs": () => jsonResponse({ error: "broken <db>" }, 500) });
  render(<RowsPage name="jobs" />);
  expect(await screen.findByText("broken <db>")).toBeTruthy();
});

test("leaving a page mid-load cancels its request", async () => {
  let signal: AbortSignal | undefined;
  stubFetch({ "/api/pages/jobs": (_url, init) => { signal = init?.signal ?? undefined; return new Promise(() => {}); } });
  const { unmount } = render(<RowsPage name="jobs" />);
  await vi.waitFor(() => expect(signal).toBeDefined());
  unmount();
  expect(signal?.aborted).toBe(true);
});
