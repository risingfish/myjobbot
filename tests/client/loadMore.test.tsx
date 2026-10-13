import { screen, within } from "@testing-library/dom";
import { act, render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { RowsPage } from "../../src/web/client/components/pages/RowsPage.js";
import { installFakeIntersectionObserver, scrollIntoView } from "../helpers/fakeObserver.js";
import { jsonResponse, stubFetch } from "../helpers/fetchStub.js";
import { jobPage, jobRowView } from "../helpers/rowFixtures.js";

beforeEach(installFakeIntersectionObserver);

function jobs(from: number, count: number) {
  return Array.from({ length: count }, (_, index) => jobRowView({ jobId: String(from + index), title: `Job ${from + index}` }));
}

function stubTwoPages() {
  return stubFetch({
    "/api/pages/jobs": (url) => url.searchParams.get("offset") === "3"
      ? jsonResponse(jobPage(jobs(3, 2), { total: 5, nextOffset: null }))
      : jsonResponse(jobPage(jobs(0, 3), { total: 5, nextOffset: 3 })),
  });
}

test("scrolling to the end of the list loads the next page once, then stops", async () => {
  const fetchMock = stubTwoPages();
  const { container } = render(<RowsPage name="jobs" />);
  await screen.findByText("Job 2");
  scrollIntoView();
  scrollIntoView();
  await screen.findByText("Job 4");
  expect(container.querySelectorAll("tr.job")).toHaveLength(5);
  expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("offset=3"))).toHaveLength(1);
  expect(container.querySelector("tr.more")).toBeNull();
});

test("the Load more button loads the next rows too", async () => {
  stubTwoPages();
  render(<RowsPage name="jobs" />);
  await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
  expect(await screen.findByText("Job 4")).toBeTruthy();
});

test("a failed load keeps the rows and offers to try again", async () => {
  stubFetch({
    "/api/pages/jobs": (url) => url.searchParams.get("offset") === "3"
      ? jsonResponse({ error: "busy" }, 500)
      : jsonResponse(jobPage(jobs(0, 3), { total: 5, nextOffset: 3 })),
  });
  const { container } = render(<RowsPage name="jobs" />);
  await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
  expect(await screen.findByText("Couldn't load more: busy")).toBeTruthy();
  expect(container.querySelectorAll("tr.job")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
});

function rowTitles(container: HTMLElement): Array<string | undefined> {
  return [...container.querySelectorAll("tr.job")].map((row) => row.querySelector("a")?.textContent);
}

function stubShiftedPages() {
  stubFetch({
    "/api/pages/jobs": (url) => url.searchParams.get("offset") === "3"
      ? jsonResponse(jobPage(jobs(2, 3), { total: 6, nextOffset: null }))
      : jsonResponse(jobPage(jobs(0, 3), { total: 5, nextOffset: 3 })),
  });
}

test("rows that shift onto the next page are shown once, never twice", async () => {
  const consoleError = vi.spyOn(console, "error");
  stubShiftedPages();
  const { container } = render(<RowsPage name="jobs" />);
  await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByText("Job 4");
  expect(rowTitles(container)).toEqual(["Job 0", "Job 1", "Job 2", "Job 3", "Job 4"]);
  expect(consoleError).not.toHaveBeenCalled();
});

function stubHideDuringLoad() {
  const stale: { answer: (response: Response) => void } = { answer: () => {} };
  const pages: Record<string, () => Response | Promise<Response>> = {
    "3": () => new Promise<Response>((resolve) => { stale.answer = resolve; }),
    "2": () => jsonResponse(jobPage(jobs(3, 2), { total: 4, nextOffset: null })),
  };
  stubFetch({
    "/api/pages/recommended": (url) => pages[url.searchParams.get("offset") ?? ""]?.() ?? jsonResponse(jobPage(jobs(0, 3), { total: 5, nextOffset: 3 })),
    "/hide": () => new Response(null, { status: 204 }),
  });
  return stale;
}

test("hiding a job while more rows are loading never skips a job", async () => {
  const stale = stubHideDuringLoad();
  const { container } = render(<RowsPage name="recommended" />);
  await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await userEvent.click(within(container.querySelectorAll("tr.job")[0] as HTMLElement).getByRole("button", { name: "Hide" }));
  await act(async () => stale.answer(jsonResponse(jobPage(jobs(4, 1), { total: 4, nextOffset: null }))));
  await userEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByText("Job 3");
  expect(rowTitles(container)).toEqual(["Job 1", "Job 2", "Job 3", "Job 4"]);
});
