import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { PageName } from "../../src/web/api.js";
import { RowsList } from "../../web/components/pages/RowsList.js";
import { jobPage, jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);

beforeEach(() => {
    actions.setJobHidden.mockReset().mockResolvedValue({ ok: true });
});

function showPage(name: PageName) {
    return render(<RowsList name={name} initial={jobPage([jobRowView({ applied: name === "applied" })])} />);
}

test("Recommended and Applied offer Hide on every row, and All jobs offers none, only the posting link", () => {
    const { unmount } = showPage("recommended");
    expect(screen.getByRole("button", { name: "Hide" })).toBeTruthy();
    unmount();
    const { container } = showPage("jobs");
    expect([screen.queryByRole("button", { name: "Hide" }), screen.queryByRole("button", { name: "Unhide" }), container.querySelector('a[aria-label="Open the posting"]') === null]).toEqual([null, null, false]);
});

function showHiddenOnAllJobs() {
    return render(<RowsList name="jobs" initial={jobPage([jobRowView({ hidden: true }), jobRowView({ jobId: "b", title: "Software Engineer b" })])} />);
}

test("All jobs shows a closed eye in place of a hidden job's question mark, and keeps its hidden note", () => {
    const { container } = showHiddenOnAllJobs();
    const rows = [...container.querySelectorAll("tr.job")];
    const [hidden, shown] = rows.map((row) => row.querySelector(".applied-cell"));
    expect([hidden?.querySelector("button.unhide svg") === null, hidden?.textContent, shown?.textContent]).toEqual([false, "", "?"]);
    expect([rows[0]?.getAttribute("data-hidden"), rows[0]?.querySelector(".hidden-note")?.textContent]).toEqual(["1", "hidden by you"]);
});

test("clicking the closed eye unhides the job once the owner confirms, and does nothing if they don't", async () => {
    const ask = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", ask);
    const { container } = showHiddenOnAllJobs();
    await userEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect([ask.mock.calls[0]?.[0], actions.setJobHidden.mock.calls.length]).toEqual(["Are you sure you want to unhide this job?", 0]);
    await userEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect(actions.setJobHidden).toHaveBeenLastCalledWith("greenhouse", "a", false);
    expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("0");
    vi.unstubAllGlobals();
});

test("hiding on Recommended saves the change and removes the row", async () => {
    const { container } = showPage("recommended");
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(container.querySelector("tr.job")).toBeNull();
    expect(actions.setJobHidden).toHaveBeenLastCalledWith("greenhouse", "a", true);
});

test("hiding on Applied marks the row and offers Unhide, which undoes it", async () => {
    const { container } = showPage("applied");
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect(actions.setJobHidden).toHaveBeenLastCalledWith("greenhouse", "a", false);
    expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("0");
});

test("a refused or failed save leaves the row as it was and says so", async () => {
    for (const failure of [() => actions.setJobHidden.mockResolvedValue({ ok: false, error: "No such job." }), () => actions.setJobHidden.mockRejectedValue(new Error("down"))]) {
        failure();
        const { container, unmount } = showPage("applied");
        await userEvent.click(screen.getByRole("button", { name: "Hide" }));
        expect(await screen.findByText("Couldn't save — try again")).toBeTruthy();
        expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("0");
        unmount();
    }
});

test("the button is disabled while the change is being saved", async () => {
    let finish: (result: { ok: true }) => void = () => {};
    actions.setJobHidden.mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    showPage("applied");
    const button = screen.getByRole("button", { name: "Hide" });
    await userEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    finish({ ok: true });
    expect(await screen.findByRole("button", { name: "Unhide" })).toBeTruthy();
});

test("a row's posting link opens the posting in a new tab, just before Hide in the same cell", () => {
    const { container } = render(<RowsList name="applied" initial={jobPage([jobRowView({ applied: true }), jobRowView({ jobId: "b", title: "Software Engineer b", url: null, applied: true })])} />);
    const [first, second] = [...container.querySelectorAll("tr.job")];
    const link = first?.querySelector('a[aria-label="Open the posting"]');
    expect([link?.getAttribute("href"), link?.getAttribute("target"), link?.getAttribute("rel")]).toEqual(["https://example.com/a", "_blank", "noopener noreferrer"]);
    expect(link?.nextElementSibling?.matches("form.hide")).toBe(true);
    expect(second?.querySelector('a[aria-label="Open the posting"]')).toBeNull();
});
