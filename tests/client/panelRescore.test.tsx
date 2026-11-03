import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PanelHeader } from "../../web/components/panel/PanelHeader.js";
import { jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ setJobApplied: vi.fn(), setJobHidden: vi.fn(), startRescore: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);

function header(running: boolean, onStart = vi.fn()) {
    return <PanelHeader job={jobRowView()} details={{ state: "loading" }} titleId="t" onApplied={vi.fn()} onHidden={vi.fn()} rescore={{ running, note: running ? null : "Re-score failed; the old score is kept", onStart }} onClose={vi.fn()} />;
}

test("pressing Re-score shows it working until the start's answer, hands it on, and stays disabled while the run goes on", async () => {
    let answer: (value: unknown) => void = () => {};
    actions.startRescore.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const onStart = vi.fn();
    const view = render(header(false, onStart));
    await userEvent.click(screen.getByRole("button", { name: "Re-score" }));
    expect([(screen.getByRole("button", { name: "Re-scoring…" }) as HTMLButtonElement).disabled, actions.startRescore.mock.calls]).toEqual([true, [["greenhouse", "a"]]]);
    answer({ failed: true });
    expect(await screen.findByRole("button", { name: "Re-score" })).toBeTruthy();
    expect([onStart.mock.calls, screen.getByText("Re-score failed; the old score is kept") !== null]).toEqual([[[{ failed: true }]], true]);
    view.rerender(header(true));
    expect((screen.getByRole("button", { name: "Re-scoring…" }) as HTMLButtonElement).disabled).toBe(true);
});
