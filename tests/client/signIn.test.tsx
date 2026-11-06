import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import PublicLayout from "../../web/app/(public)/layout.js";
import { SignInForm } from "../../web/components/account/SignInForm.js";

vi.mock("../../web/lib/signInActions.js", () => ({ signInWithPasswordForm: vi.fn(async () => ({ message: MESSAGES.signin_failed })) }));

test("the sign-in page asks for an email and password, answers a refusal with one fixed message, and shows nothing about the app or server", async () => {
    const { container } = render(
        <PublicLayout>
            <SignInForm next="/jobs" />
        </PublicLayout>,
    );
    await userEvent.type(screen.getByLabelText("Email"), "nobody@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.signin_failed);
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).not.toMatch(/@ |database|Recommended/);
    expect((container.querySelector('input[name="next"]') as HTMLInputElement).value).toBe("/jobs");
});
