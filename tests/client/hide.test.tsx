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
    return render(<RowsList name={name} initial={jobPage([jobRowView()])} />);
}

test("every job row offers a Hide button", () => {
    showPage("recommended");
    expect(screen.getByRole("button", { name: "Hide" })).toBeTruthy();
});

test("hiding on Recommended saves the change and removes the row", async () => {
    const { container } = showPage("recommended");
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(container.querySelector("tr.job")).toBeNull();
    expect(actions.setJobHidden).toHaveBeenLastCalledWith("greenhouse", "a", true);
});

test("hiding on All jobs marks the row and offers Unhide, which undoes it", async () => {
    const { container } = showPage("jobs");
    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect(actions.setJobHidden).toHaveBeenLastCalledWith("greenhouse", "a", false);
    expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("0");
});

test("a refused or failed save leaves the row as it was and says so", async () => {
    for (const failure of [() => actions.setJobHidden.mockResolvedValue({ ok: false, error: "No such job." }), () => actions.setJobHidden.mockRejectedValue(new Error("down"))]) {
        failure();
        const { container, unmount } = showPage("jobs");
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
    showPage("jobs");
    const button = screen.getByRole("button", { name: "Hide" });
    await userEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    finish({ ok: true });
    expect(await screen.findByRole("button", { name: "Unhide" })).toBeTruthy();
});

test("a row's posting link opens the posting in a new tab, just before Hide in the same cell", () => {
    const { container } = render(<RowsList name="jobs" initial={jobPage([jobRowView(), jobRowView({ jobId: "b", title: "Software Engineer b", url: null })])} />);
    const [first, second] = [...container.querySelectorAll("tr.job")];
    const link = first?.querySelector('a[aria-label="Open the posting"]');
    expect([link?.getAttribute("href"), link?.getAttribute("target"), link?.getAttribute("rel")]).toEqual(["https://example.com/a", "_blank", "noopener noreferrer"]);
    expect(link?.nextElementSibling?.matches("form.hide")).toBe(true);
    expect(second?.querySelector('a[aria-label="Open the posting"]')).toBeNull();
});
