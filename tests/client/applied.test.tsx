import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { rowLabel } from "../../web/lib/appliedTime.js";
import { RowsList } from "../../web/components/pages/RowsList.js";
import { jobPage, jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn(), setJobApplied: vi.fn() }));
const MARKED_AT = "2026-10-23T16:40:00.000Z";
const APPLIED_NAME = rowLabel({ applied: true, appliedOn: MARKED_AT }, Intl.DateTimeFormat().resolvedOptions().timeZone);

vi.mock("../../web/lib/actions.js", () => actions);

beforeEach(() => {
    actions.setJobApplied.mockReset().mockResolvedValue({ ok: true, appliedOn: MARKED_AT });
});

async function click(name: string, confirmed = true) {
    vi.stubGlobal("confirm", vi.fn(() => confirmed));
    await userEvent.click(await screen.findByRole("button", { name }));
}

function failNext(how: "refused" | "rejected") {
    if (how === "refused") actions.setJobApplied.mockResolvedValueOnce({ ok: false, error: "No such job." });
    else actions.setJobApplied.mockRejectedValueOnce(new Error("down"));
}

test("a row's mark marks the job applied, and undoes it only once the owner confirms, saying when a save fails", async () => {
    const { container } = render(<RowsList name="recommended" initial={jobPage([jobRowView()])} />);
    await click("Mark as applied");
    expect([actions.setJobApplied.mock.lastCall, container.querySelectorAll("tr.job").length]).toEqual([["greenhouse", "a", true], 1]);
    await click(APPLIED_NAME, false);
    expect([actions.setJobApplied.mock.calls.length, screen.queryByText("Couldn't save — try again")]).toEqual([1, null]);
    actions.setJobApplied.mockResolvedValueOnce({ ok: true, appliedOn: null });
    await click(APPLIED_NAME);
    expect(actions.setJobApplied.mock.lastCall).toEqual(["greenhouse", "a", false]);
    failNext("refused");
    await click("Mark as applied");
    expect(await screen.findByText("Couldn't save — try again")).toBeTruthy();
    await click("Mark as applied");
    failNext("rejected");
    await click(APPLIED_NAME);
    expect(await screen.findByRole("button", { name: APPLIED_NAME })).toBeTruthy();
});
