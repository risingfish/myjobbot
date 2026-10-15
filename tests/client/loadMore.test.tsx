import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
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
