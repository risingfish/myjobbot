import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { CreateAccountForm } from "../../web/components/account/CreateAccountForm.js";

vi.mock("../../web/lib/signInActions.js", () => ({ createAccountForm: vi.fn(async (_previous: unknown, form: FormData) => ({ message: MESSAGES.code_refused, field: "code", email: String(form.get("email")), name: String(form.get("name")) })) }));

test("the account form shows the password rule once, puts a refusal right under its field, marked, and keeps the email and name typed", async () => {
    render(<CreateAccountForm />);
    expect(screen.getByText(MESSAGES.password_rule)).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Name"), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText("Password"), "Abcdefgh1!");
    await userEvent.type(screen.getByLabelText("Account creation code"), "made-up");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(MESSAGES.code_refused);
    const code = screen.getByLabelText("Account creation code");
    expect([code.getAttribute("aria-invalid"), code.nextElementSibling]).toEqual(["true", alert]);
    expect(screen.getAllByText(MESSAGES.password_rule)).toHaveLength(1);
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBeNull();
    expect([(screen.getByLabelText("Email") as HTMLInputElement).value, (screen.getByLabelText("Name") as HTMLInputElement).value]).toEqual(["ada@example.com", "Ada Lovelace"]);
});
