import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { SignInForm } from "../../web/components/account/SignInForm.js";
import { KeyControls } from "../../web/components/account/KeyControls.js";

const browser = vi.hoisted(() => ({ startRegistration: vi.fn(async () => ({ id: "cred-new" })), startAuthentication: vi.fn(async () => ({ id: "cred-1" })), browserSupportsWebAuthn: () => true }));
const keyActions = vi.hoisted(() => ({
    startKeyRegistration: vi.fn(async () => ({ ok: true as const, options: { challenge: "c" } })),
    finishKeyRegistration: vi.fn(async () => ({ ok: false as const, message: "Another of your keys has that name." })),
    removeKey: vi.fn(async () => ({ ok: true as const })),
    startKeySignIn: vi.fn(async () => ({ ok: true as const, options: { challenge: "s" } })),
    finishKeySignIn: vi.fn(async (_form: FormData) => ({ message: null })),
}));
vi.mock("@simplewebauthn/browser", () => browser);
vi.mock("../../web/lib/keyActions.js", () => keyActions);
vi.mock("../../web/lib/accountActions.js", () => ({ confirmIdentity: vi.fn(), requestStepUpLink: vi.fn() }));
vi.mock("../../web/lib/authenticatorActions.js", () => ({ makeRecoveryCodes: vi.fn() }));
vi.mock("../../web/lib/signInActions.js", () => ({ signInForm: vi.fn(), requestSignInLinkForm: vi.fn(), requestPasswordResetForm: vi.fn() }));

test("keys are listed by name with Delete, a key needs a name, and a repeated name is refused under the field", async () => {
    render(<KeyControls keys={[{ id: 4, name: "Blue key" }]} />);
    const list = screen.getByRole("table", { name: "Hardware keys" });
    expect(within(list).getByText("Blue key")).toBeTruthy();
    await userEvent.click(within(list).getByRole("button", { name: "Delete" }));
    expect(keyActions.removeKey).toHaveBeenCalledWith(4);
    expect(screen.getByLabelText("Key name").hasAttribute("required")).toBe(true);
    await userEvent.type(screen.getByLabelText("Key name"), "Blue key");
    await userEvent.click(screen.getByRole("button", { name: "Add key" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.key_name_taken);
    expect(screen.getByLabelText("Key name").getAttribute("aria-invalid")).toBe("true");
    expect(browser.startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: "c" } });
});

test("the sign-in page's Hardware key choice asks the browser for a key and signs in with its answer", async () => {
    render(<SignInForm next="/jobs" />);
    await userEvent.type(screen.getByLabelText("Email"), "zac@forthebrew.com");
    await userEvent.click(screen.getByRole("radio", { name: "Hardware key" }));
    expect(screen.getByText("Touch your key when your browser asks.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await vi.waitFor(() => expect(keyActions.finishKeySignIn).toHaveBeenCalled());
    const form = keyActions.finishKeySignIn.mock.calls[0]?.[0];
    if (form === undefined) throw new Error("no sign-in");
    expect([form.get("email"), form.get("response"), form.get("next")]).toEqual(["zac@forthebrew.com", JSON.stringify({ id: "cred-1" }), "/jobs"]);
});
