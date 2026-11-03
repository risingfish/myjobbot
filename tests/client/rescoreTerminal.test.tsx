import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RescoreTerminal } from "../../web/components/panel/RescoreTerminal.js";
import { FakeSource } from "../helpers/fakeEventSource.js";

const LOST = "live view lost: reopen the log from History";

beforeEach(() => {
    vi.useFakeTimers();
    FakeSource.opened = [];
    vi.stubGlobal("EventSource", FakeSource);
    vi.spyOn(Element.prototype, "scrollTo").mockReturnValue(Promise.resolve() as unknown as undefined);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function shown(run: string) {
    const calls = { ended: vi.fn(), closed: vi.fn() };
    const view = render(<RescoreTerminal run={run} job={{ ats: "greenhouse", jobId: "a" }} onEnd={calls.ended} onClose={calls.closed} />);
    return { ...calls, view, source: FakeSource.opened.at(-1) as FakeSource, log: () => screen.getByRole("log").textContent ?? "", cursor: () => view.container.querySelector(".terminal-cursor") };
}

function wait(ms: number) {
    act(() => void vi.advanceTimersByTime(ms));
}

function followsToTheEnd() {
    const terminal = shown("run-1");
    expect([terminal.view.container.querySelector("[data-theme='dark']") !== null, terminal.source.url, terminal.log()]).toEqual([true, "/api/rescores/run-1", "$ myjobbot rescore greenhouse a"]);
    terminal.source.emit("step", { seq: 1, elapsedMs: 10, line: "settings loaded" });
    terminal.source.emit("step", { seq: 1, elapsedMs: 10, line: "settings loaded" });
    terminal.source.emit("step", { seq: 2, elapsedMs: 2400, line: "done: model score 72" });
    expect([terminal.log(), terminal.cursor() !== null]).toEqual(["$ myjobbot rescore greenhouse a[  0.0s] settings loaded[  2.4s] done: model score 72", true]);
    terminal.source.emit("end", { outcome: "scored", filter: null, score: 72 });
    wait(20_000);
    expect([terminal.cursor(), terminal.ended.mock.calls, terminal.source.readyState, terminal.log().includes(LOST)]).toEqual([null, [[{ outcome: "scored", filter: null, score: 72 }]], FakeSource.CLOSED, false]);
    fireEvent.click(screen.getByRole("button", { name: "Close the re-score log" }));
    expect(terminal.closed).toHaveBeenCalledOnce();
    terminal.view.unmount();
}

function losesTheLiveView() {
    const quiet = shown("run-2");
    for (let i = 0; i < 4; i++) (wait(5000), quiet.source.emit("ping", {}));
    expect(quiet.log().includes(LOST)).toBe(false);
    wait(15_000);
    expect([quiet.log().includes(LOST), quiet.cursor(), quiet.source.readyState]).toEqual([true, null, FakeSource.CLOSED]);
    quiet.view.unmount();
    const closed = shown("run-3");
    closed.source.readyState = FakeSource.CLOSED;
    act(() => closed.source.onerror?.());
    expect(closed.log().includes(LOST)).toBe(true);
}

test("the terminal follows a run's lines to its end and closes with its ×, and says the live view is lost when the stream closes or goes quiet", () => {
    followsToTheEnd();
    losesTheLiveView();
});
