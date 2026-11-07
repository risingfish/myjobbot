import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { shownRefusal, StepUpProvider, useStepUp } from "../../web/components/account/StepUp.js";

const actions = vi.hoisted(() => ({ confirmIdentity: vi.fn(async () => ({ ok: true as const })), requestStepUpLink: vi.fn() }));
vi.mock("../../web/lib/keyActions.js", () => ({ startKeySignIn: vi.fn(), finishKeySignIn: vi.fn(), startKeyRegistration: vi.fn(), finishKeyRegistration: vi.fn(), removeKey: vi.fn() }));
vi.mock("../../web/lib/accountActions.js", () => actions);

const change = vi.fn().mockResolvedValueOnce({ ok: false, message: "Confirm it's you to continue.", stepUp: true }).mockResolvedValueOnce({ ok: true });

function Change() {
    const run = useStepUp();
    return (
        <button type="button" onClick={() => void run(change)}>
            Change
        </button>
    );
}

test("a step-up answer opens the Confirm it's you dialog, and once confirmed the change is made again", async () => {
    render(
        <StepUpProvider>
            <Change />
        </StepUpProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
    expect(dialog.textContent).toContain(MESSAGES.step_up);
    await userEvent.type(screen.getByLabelText("Password", { selector: "input[type=password]" }), "Abcdefgh1!");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await vi.waitFor(() => expect(change).toHaveBeenCalledTimes(2));
    expect(actions.confirmIdentity).toHaveBeenCalledWith("password", "Abcdefgh1!");
    expect(screen.queryByRole("dialog")).toBeNull();
});

test("a change that only asked to confirm shows nothing once the dialog is cancelled, and a real refusal still shows", () => {
    expect(shownRefusal({ ok: false, message: MESSAGES.step_up, stepUp: true })).toBeNull();
    expect(shownRefusal({ ok: true })).toBeNull();
    expect(shownRefusal({ ok: false, message: MESSAGES.last_way })).toBe(MESSAGES.last_way);
});
