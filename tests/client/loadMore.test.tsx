import { screen, within } from "@testing-library/dom";
import { act, render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { PageData } from "../../src/web/api.js";
import { RowsList } from "../../web/components/pages/RowsList.js";
import { installFakeIntersectionObserver, scrollIntoView } from "../helpers/fakeObserver.js";
import { jobPage, jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);

beforeEach(() => {
    installFakeIntersectionObserver();
    actions.loadMoreRows.mockReset();
    actions.setJobHidden.mockReset().mockResolvedValue({ ok: true });
});

function jobs(from: number, count: number) {
    return Array.from({ length: count }, (_, index) => jobRowView({ jobId: String(from + index), title: `Job ${from + index}` }));
}

function firstPage(): PageData {
    return jobPage(jobs(0, 3), { total: 5, nextOffset: 3 });
}

function rowTitles(container: HTMLElement): Array<string | undefined> {
    return [...container.querySelectorAll("tr.job")].map((row) => row.querySelector("a")?.textContent);
}

test("scrolling to the end of the list loads the next page once, then stops", async () => {
    actions.loadMoreRows.mockResolvedValue(jobPage(jobs(3, 2), { total: 5, nextOffset: null }));
    const { container } = render(<RowsList name="jobs" initial={firstPage()} />);
    scrollIntoView();
    scrollIntoView();
    await screen.findByText("Job 4");
    expect(container.querySelectorAll("tr.job")).toHaveLength(5);
    expect(actions.loadMoreRows.mock.calls).toEqual([["jobs", 3]]);
    expect(container.querySelector("tr.more")).toBeNull();
});

test("the Load more button loads the next rows too", async () => {
    actions.loadMoreRows.mockResolvedValue(jobPage(jobs(3, 2), { total: 5, nextOffset: null }));
    render(<RowsList name="jobs" initial={firstPage()} />);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Job 4")).toBeTruthy();
});

test("a failed load keeps the rows and offers to try again", async () => {
    actions.loadMoreRows.mockRejectedValue(new Error("busy"));
    const { container } = render(<RowsList name="jobs" initial={firstPage()} />);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Couldn't load more: busy")).toBeTruthy();
    expect(container.querySelectorAll("tr.job")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
});

test("rows that shift onto the next page are shown once, never twice", async () => {
    const consoleError = vi.spyOn(console, "error");
    actions.loadMoreRows.mockResolvedValue(jobPage(jobs(2, 3), { total: 6, nextOffset: null }));
    const { container } = render(<RowsList name="jobs" initial={firstPage()} />);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Job 4");
    expect(rowTitles(container)).toEqual(["Job 0", "Job 1", "Job 2", "Job 3", "Job 4"]);
    expect(consoleError).not.toHaveBeenCalled();
});

function answerOffsetTwoLater() {
    const stale: { answer: (page: PageData) => void } = { answer: () => {} };
    actions.loadMoreRows.mockImplementation((_name: string, offset: number) =>
        offset === 2
            ? Promise.resolve(jobPage(jobs(3, 2), { total: 4, nextOffset: null }))
            : new Promise<PageData>((resolve) => {
                  stale.answer = resolve;
              }),
    );
    return stale;
}

test("hiding a job while more rows are loading never skips a job", async () => {
    const stale = answerOffsetTwoLater();
    const { container } = render(<RowsList name="recommended" initial={firstPage()} />);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await userEvent.click(within(container.querySelectorAll("tr.job")[0] as HTMLElement).getByRole("button", { name: "Hide" }));
    await act(async () => stale.answer(jobPage(jobs(4, 1), { total: 4, nextOffset: null })));
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Job 3");
    expect(rowTitles(container)).toEqual(["Job 1", "Job 2", "Job 3", "Job 4"]);
});
