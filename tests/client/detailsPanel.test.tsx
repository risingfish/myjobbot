import { fireEvent, screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { JobRowView, PageName } from "../../src/web/api.js";
import { RowsList } from "../../web/components/pages/RowsList.js";
import { jobPage, jobRowView, verdictPage, verdictRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);
vi.mock("next/navigation.js", () => import("../helpers/navigation.js"));

const ROWS = [jobRowView(), jobRowView({ jobId: "b", title: "Backend Engineer b", company: "Beta" })];

beforeEach(() => {
    actions.setJobHidden.mockReset().mockResolvedValue({ ok: true });
});

function showPage(name: PageName = "jobs", rows: JobRowView[] = ROWS) {
    return render(<RowsList name={name} initial={jobPage(rows)} />);
}

function panel(): HTMLDialogElement | null {
    return document.querySelector("dialog.details-panel");
}

async function openTitle(title: string) {
    await userEvent.click(screen.getByRole("link", { name: title }));
}

test("clicking a title opens a panel named by the job, showing its details, with the job in the address", async () => {
    showPage();
    await openTitle("Software Engineer a");
    const open = panel();
    expect(open?.open).toBe(true);
    expect(open?.getAttribute("aria-labelledby") && document.getElementById(open.getAttribute("aria-labelledby") ?? "")?.textContent).toBe("Software Engineer a");
    for (const text of ["Acme", "Remote", "Yes", "Stripe", "2026-09-30 · 3 days open", "Not hidden"]) expect(open?.textContent).toContain(text);
    expect(location.search).toBe("?job=greenhouse%3Aa");
});

test("clicking another title switches the panel to that job", async () => {
    showPage();
    await openTitle("Software Engineer a");
    await openTitle("Backend Engineer b");
    expect(within(panel() as HTMLElement).getByRole("heading", { level: 2 }).textContent).toBe("Backend Engineer b");
    expect(location.search).toBe("?job=greenhouse%3Ab");
});

test("the close button, Escape and a click outside close the panel and take the job out of the address", async () => {
    showPage();
    for (const close of [() => userEvent.click(screen.getByRole("button", { name: "Close" })), () => userEvent.keyboard("{Escape}"), () => fireEvent.pointerDown(screen.getByText("2 jobs"))]) {
        await openTitle("Software Engineer a");
        await close();
        expect([panel()?.open, location.search]).toEqual([false, ""]);
    }
});

test("clicking another title or a row's Hide doesn't close the panel", async () => {
    showPage();
    await openTitle("Software Engineer a");
    fireEvent.pointerDown(screen.getByRole("link", { name: "Backend Engineer b" }));
    fireEvent.pointerDown(screen.getAllByRole("button", { name: "Hide" })[1] as HTMLElement);
    expect(panel()?.open).toBe(true);
});

test("going back to an address without a job closes the panel without adding history", async () => {
    showPage();
    await openTitle("Software Engineer a");
    const push = vi.spyOn(history, "pushState");
    history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(panel()?.open).toBe(false));
    expect(push).not.toHaveBeenCalled();
});

test("an address naming a job that isn't listed opens the panel saying so", () => {
    history.replaceState(null, "", "/?job=greenhouse%3Azzz");
    showPage();
    expect(within(panel() as HTMLElement).getByText("job not found", { exact: false })).toBeTruthy();
});

test("hiding the open job on Recommended removes its row but keeps the panel showing it, as hidden", async () => {
    showPage("recommended");
    await openTitle("Software Engineer a");
    await userEvent.click(screen.getAllByRole("button", { name: "Hide" })[0] as HTMLElement);
    expect(screen.queryByRole("link", { name: "Software Engineer a" })).toBeNull();
    expect(within(panel() as HTMLElement).getByText("Hidden by you")).toBeTruthy();
});

test("job text in the panel is shown as text, never run", async () => {
    showPage("jobs", [jobRowView({ title: "<script>alert(1)</script>" })]);
    await openTitle("<script>alert(1)</script>");
    expect(panel()?.querySelector("script")).toBeNull();
});

test("the Reasoning page never opens the panel", () => {
    history.replaceState(null, "", "/?job=greenhouse%3Aa");
    render(<RowsList name="reasoning" initial={verdictPage([verdictRowView()])} />);
    expect(panel()).toBeNull();
});
