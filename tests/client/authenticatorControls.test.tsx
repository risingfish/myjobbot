import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { AuthenticatorControls } from "../../web/components/account/AuthenticatorControls.js";

const CODES = Array.from({ length: 10 }, (_, index) => `ABCDE-FGH${String.fromCharCode(74 + index)}${index}`);
const actions = vi.hoisted(() => ({
    startAuthenticatorSetup: vi.fn(async () => ({ ok: true as const, qr: "data:image/png;base64,AAAA", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" })),
    confirmAuthenticator: vi.fn(),
    removeAuthenticator: vi.fn(),
    makeRecoveryCodes: vi.fn(),
}));
vi.mock("../../web/lib/authenticatorActions.js", () => actions);
vi.mock("../../web/lib/accountActions.js", () => ({ confirmIdentity: vi.fn(), requestStepUpLink: vi.fn() }));

test("setup shows the QR code and the key to type, refuses a wrong code under its field, then shows the ten recovery codes once", async () => {
    actions.confirmAuthenticator.mockResolvedValueOnce({ ok: false, message: MESSAGES.code_wrong }).mockResolvedValueOnce({ ok: true, recoveryCodes: CODES });
    render(<AuthenticatorControls ready={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Start setup" }));
    expect((await screen.findByRole("img", { name: "QR code for your authenticator app" })).getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(screen.getByText("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP").tagName).toBe("CODE");
    await userEvent.type(screen.getByLabelText("Code from your app"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.code_wrong);
    await userEvent.type(screen.getByLabelText("Code from your app"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect((await screen.findByText(/Keep these recovery codes/)).textContent).toContain("aren't shown again");
    expect(screen.getByText(CODES[0] ?? "", { exact: false }).textContent?.split("\n")).toEqual(CODES);
    await userEvent.click(screen.getByRole("button", { name: "I've saved them" }));
    expect(screen.queryByText(CODES[0] ?? "", { exact: false })).toBeNull();
});
