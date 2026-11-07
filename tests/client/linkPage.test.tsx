import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { LinkButton } from "../../web/components/account/LinkButton.js";

const actions = vi.hoisted(() => ({ spendEmailLinkNow: vi.fn() }));
vi.mock("../../web/lib/signInActions.js", () => actions);

const TOKEN = "a".repeat(43);

async function resetUsedOnlyWhenPressed() {
    const button = await screen.findByRole("button", { name: "Set new password" });
    expect([window.location.hash, actions.spendEmailLinkNow.mock.calls.length]).toEqual(["", 0]);
    expect(screen.getByText(MESSAGES.password_rule)).toBeTruthy();
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.click(button);
    expect(actions.spendEmailLinkNow).toHaveBeenLastCalledWith(`#p=reset&t=${TOKEN}`, "short");
    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("true");
    await userEvent.type(screen.getByLabelText("New password"), "Newpassword1!");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
}

test("the link page reads the fragment once, even when React runs its effects twice, clears it at once, uses the link only when its button is pressed, and says what happened", async () => {
    window.history.replaceState(null, "", `/link#p=reset&t=${TOKEN}`);
    actions.spendEmailLinkNow.mockResolvedValueOnce({ ok: false, message: MESSAGES.password_rule }).mockResolvedValueOnce({ ok: true, kind: "reset", next: "/" });
    const { unmount } = render(
        <StrictMode>
            <LinkButton />
        </StrictMode>,
    );
    await resetUsedOnlyWhenPressed();
    expect((await screen.findByRole("status")).textContent).toContain("Your password is set");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
    unmount();
    window.history.replaceState(null, "", "/link#p=signin&t=bad");
    render(<LinkButton />);
    expect((await screen.findByRole("alert")).textContent).toContain(MESSAGES.link_expired);
    expect(screen.getByRole("link", { name: "Send a new link" })).toBeTruthy();
});
