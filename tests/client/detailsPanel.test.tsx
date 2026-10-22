import { fireEvent, screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { JobRowView } from "../../src/web/api.js";
import { RowsList } from "../../web/components/pages/RowsList.js";
import { deferred, details, heading, listedDetails, openTitle, panel, ROWS, showPage } from "../helpers/panelPage.js";
import { jobRowView, verdictPage, verdictRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn(), loadJobDetails: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);
vi.mock("next/navigation.js", () => import("../helpers/navigation.js"));

beforeEach(() => {
    actions.setJobHidden.mockReset().mockResolvedValue({ ok: true });
    actions.loadJobDetails.mockReset().mockImplementation(listedDetails);
});

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

test("a closed panel keeps the last job's details so it can slide out", async () => {
    showPage();
    await openTitle("Software Engineer a");
    await userEvent.keyboard("{Escape}");
    expect(panel()?.open).toBe(false);
    expect(panel()?.textContent).toContain("Software Engineer a");
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

test("an address naming a job that doesn't exist opens the panel saying so", async () => {
    history.replaceState(null, "", "/?job=greenhouse%3Azzz");
    showPage();
    await vi.waitFor(() => expect(heading()).toBe("Job not found"));
});

test("a job that isn't listed is loaded and shown", async () => {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView({ jobId: "zzz", title: "Platform Engineer zzz" })));
    history.replaceState(null, "", "/?job=greenhouse%3Azzz");
    showPage();
    await vi.waitFor(() => expect(heading()).toBe("Platform Engineer zzz"));
    expect(actions.loadJobDetails).toHaveBeenCalledWith("greenhouse", "zzz");
});

test("the panel says it is loading until the details arrive, then shows the pay and workplace terms", async () => {
    const answer = deferred();
    actions.loadJobDetails.mockReturnValue(answer.promise);
    showPage();
    await openTitle("Software Engineer a");
    expect(panel()?.textContent).toContain("Loading…");
    answer.resolve(details(jobRowView(), { pay: "$150k–$180k", workplace: "hybrid" }));
    await vi.waitFor(() => expect(panel()?.textContent).toContain("$150k–$180k"));
    expect([panel()?.textContent?.includes("hybrid"), panel()?.textContent?.includes("Loading…")]).toEqual([true, false]);
});

test("a failed load says why", async () => {
    actions.loadJobDetails.mockRejectedValue(new Error("database down"));
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(panel()?.textContent).toContain("Couldn't load details: database down"));
});

test("an answer for a job that is no longer open is ignored", async () => {
    const first = deferred();
    actions.loadJobDetails.mockReturnValueOnce(first.promise).mockResolvedValueOnce(details(ROWS[1] as JobRowView, { pay: "$2" }));
    showPage();
    await openTitle("Software Engineer a");
    await openTitle("Backend Engineer b");
    await vi.waitFor(() => expect(panel()?.textContent).toContain("$2"));
    first.resolve(details(jobRowView(), { pay: "$1" }));
    await first.promise;
    expect([heading(), panel()?.textContent?.includes("$1")]).toEqual(["Backend Engineer b", false]);
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
