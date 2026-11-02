import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PanelHeader } from "../../web/components/panel/PanelHeader.js";
import { jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ setJobApplied: vi.fn(), setJobHidden: vi.fn(), rescoreJob: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);

test("pressing Re-score shows it working until the answer, and a failure says so without refreshing anything", async () => {
    let answer: (value: unknown) => void = () => {};
    actions.rescoreJob.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const onRescored = vi.fn();
    render(<PanelHeader job={jobRowView()} details={{ state: "loading" }} titleId="t" onApplied={vi.fn()} onHidden={vi.fn()} onRescored={onRescored} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Re-score" }));
    expect((screen.getByRole("button", { name: "Re-scoring…" }) as HTMLButtonElement).disabled).toBe(true);
    answer({ outcome: "failed" });
    expect(await screen.findByText("Re-score failed; the old score is kept")).toBeTruthy();
    expect([(screen.getByRole("button", { name: "Re-score" }) as HTMLButtonElement).disabled, onRescored.mock.calls.length]).toEqual([false, 0]);
});
