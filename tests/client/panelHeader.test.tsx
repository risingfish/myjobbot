import { screen, within } from "@testing-library/dom";
import { cleanup } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { appliedFact } from "../../web/lib/appliedTime.js";
import { details, heading, listedDetails, openTitle, panel, ROWS, section, showPage } from "../helpers/panelPage.js";
import { jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn(), setJobApplied: vi.fn(), loadJobDetails: vi.fn() }));
const MARKED_AT = "2026-10-23T16:40:00.000Z";
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

vi.mock("../../web/lib/actions.js", () => actions);
vi.mock("next/navigation.js", () => import("../helpers/navigation.js"));

beforeEach(() => {
    actions.setJobHidden.mockReset().mockResolvedValue({ ok: true });
    actions.setJobApplied.mockReset().mockResolvedValue({ ok: true, appliedOn: MARKED_AT });
    actions.loadJobDetails.mockReset().mockImplementation(listedDetails);
});

function inPanel() {
    return within(panel() as HTMLElement);
}

async function clickInPanel(name: string, confirmed = true) {
    vi.stubGlobal("confirm", vi.fn(() => confirmed));
    await userEvent.click(await inPanel().findByRole("button", { name }));
}

function headerButtons(): string[] {
    return inPanel()
        .getAllByRole("button")
        .map((button) => button.textContent ?? "");
}

async function marksFromThePanel() {
    showPage();
    await openTitle("Software Engineer a");
    expect([headerButtons()[0], headerButtons().at(-1)]).toEqual(["Applied", "Close"]);
    await clickInPanel("Applied");
    expect(actions.setJobApplied).toHaveBeenLastCalledWith("greenhouse", "a", true);
    expect(await inPanel().findByRole("button", { name: "Applied ✓" })).toBeTruthy();
    expect(section("Job").textContent).toContain(appliedFact({ applied: true, appliedOn: MARKED_AT }, ZONE));
    expect(screen.queryAllByRole("button", { name: "Mark as applied" })).toHaveLength(1);
    await clickInPanel("Applied ✓", false);
    expect(actions.setJobApplied).toHaveBeenCalledTimes(1);
    actions.setJobApplied.mockResolvedValueOnce({ ok: true, appliedOn: null });
    await clickInPanel("Applied ✓");
    expect(await inPanel().findByRole("button", { name: "Applied" })).toBeTruthy();
    cleanup();
}

async function followsTheRow() {
    showPage();
    await openTitle("Backend Engineer b");
    const rowB = screen.getByRole("link", { name: "Backend Engineer b" }).closest("tr") as HTMLElement;
    await userEvent.click(within(rowB).getByRole("button", { name: "Mark as applied" }));
    expect(await inPanel().findByRole("button", { name: "Applied ✓" })).toBeTruthy();
    cleanup();
}

async function failsAndOpensApplied() {
    actions.setJobApplied.mockResolvedValueOnce({ ok: false, error: "No such job." });
    showPage();
    await openTitle("Software Engineer a");
    await clickInPanel("Applied");
    expect([await inPanel().findByText("Couldn't save — try again"), inPanel().getByRole("button", { name: "Applied" })]).toBeTruthy();
    cleanup();
    showPage("jobs", [jobRowView({ applied: true, appliedOn: MARKED_AT }), ...ROWS.slice(1)]);
    await openTitle("Software Engineer a");
    expect(await inPanel().findByRole("button", { name: "Applied ✓" })).toBeTruthy();
    cleanup();
}

async function followsAnUnlistedJob() {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView({ jobId: "zzz", title: "Platform Engineer zzz" })));
    history.replaceState(null, "", "/?job=greenhouse%3Azzz");
    showPage();
    await vi.waitFor(() => expect(heading()).toBe("Platform Engineer zzz"));
    await clickInPanel("Applied");
    expect(await inPanel().findByRole("button", { name: "Applied ✓" })).toBeTruthy();
    await userEvent.click(screen.getAllByRole("button", { name: "Mark as applied" })[0] as HTMLElement);
    expect(await inPanel().findByRole("button", { name: "Applied ✓" })).toBeTruthy();
}

test("the panel's Applied marks the job, follows its row and its own job, and says when a save fails", async () => {
    await marksFromThePanel();
    await followsTheRow();
    await failsAndOpensApplied();
    await followsAnUnlistedJob();
});

async function hidesAndCloses(page: "recommended" | "jobs") {
    showPage(page);
    await openTitle("Software Engineer a");
    await clickInPanel("Hide");
    expect(actions.setJobHidden).toHaveBeenLastCalledWith("greenhouse", "a", true);
    await vi.waitFor(() => expect(panel()?.open).toBe(false));
    const row = screen.queryByRole("link", { name: "Software Engineer a" })?.closest("tr") ?? null;
    if (page === "recommended") expect(row).toBeNull();
    else expect(within(row as HTMLElement).getByRole("button", { name: "Unhide" })).toBeTruthy();
    cleanup();
}

async function staysOpenOnFailure() {
    actions.setJobHidden.mockResolvedValueOnce({ ok: false, error: "No such job." });
    showPage("recommended");
    await openTitle("Software Engineer a");
    await clickInPanel("Hide");
    expect([await inPanel().findByText("Couldn't save — try again"), panel()?.open]).toEqual([expect.anything(), true]);
    cleanup();
}

async function disabledForAHiddenJob() {
    showPage("jobs", [jobRowView({ hidden: true }), ...ROWS.slice(1)]);
    await openTitle("Software Engineer a");
    const hide = await inPanel().findByRole("button", { name: "Hide (already hidden)" });
    expect([(hide as HTMLButtonElement).disabled, hide.getAttribute("title")]).toEqual([true, "Already hidden"]);
}

test("the panel's Hide sits between Applied and Close, hides the job and closes the panel, and is disabled for a hidden job", async () => {
    showPage();
    await openTitle("Software Engineer a");
    expect(headerButtons()).toEqual(["Applied", "Hide", "Close"]);
    cleanup();
    await hidesAndCloses("recommended");
    await hidesAndCloses("jobs");
    await staysOpenOnFailure();
    await disabledForAHiddenJob();
});
