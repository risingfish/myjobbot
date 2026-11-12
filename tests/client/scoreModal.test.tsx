import { screen, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { details, showPage } from "../helpers/panelPage.js";
import { jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn(), loadJobDetails: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);
vi.mock("next/navigation.js", () => import("../helpers/navigation.js"));

const SCORE = { total: 75, model: 70, boost: { total: 5, lines: ["backend +5 (title)"] }, base: 40, bonus: 30, reasons: ["Strong Go"], gaps: ["No Kafka"], scoredAt: "2026-11-12 17:04" };
const HISTORY = [{ scoredAt: "2026-11-12 17:04", total: 70, base: 40, bonus: 30, run: "1dffa99e", rescore: null }];

beforeEach(() => {
    actions.loadJobDetails.mockReset().mockResolvedValue(details(jobRowView(), {}, { score: SCORE, history: HISTORY }));
});

async function openModal() {
    showPage("jobs", [jobRowView()]);
    await userEvent.click(screen.getByRole("button", { name: "Score details" }));
    const modal = await screen.findByRole("dialog", { name: "Score for Software Engineer a" });
    await vi.waitFor(() => expect(modal.textContent).toContain("Strong Go"));
    return modal;
}

test("the magnifier opens the score in rows: run and time, the score and boosts, the reasons, then the gaps", async () => {
    const modal = await openModal();
    const text = modal.textContent ?? "";
    const order = ["Run 1dffa99e · scored 2026-11-12 17:04", "75 (model 70: resume fit 40 of 50, preference fit 30 of 50)", "+5", "backend +5 (title)", "Reasons", "Strong Go", "Gaps", "No Kafka"].map((part) => text.indexOf(part));
    expect(order.every((at, index) => at >= 0 && (index === 0 || at > (order[index - 1] ?? 0)))).toBe(true);
    expect(actions.loadJobDetails).toHaveBeenCalledWith("greenhouse", "a");
});

const CLOSERS = {
    "the X": () => userEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Close" })[0] as HTMLElement),
    "the Close button": () => userEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Close" })[1] as HTMLElement),
    Escape: () => userEvent.keyboard("{Escape}"),
};

test.each(Object.entries(CLOSERS))("%s closes the modal", async (_name, close) => {
    await openModal();
    await close();
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Score for Software Engineer a" })).toBeNull());
});

test("an unscored job has no magnifier", () => {
    showPage("jobs", [jobRowView({ score: null })]);
    expect(screen.queryByRole("button", { name: "Score details" })).toBeNull();
});
