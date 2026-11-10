import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { AccountStatus } from "../../web/components/account/AccountStatus.js";
import { AccountBanner } from "../../web/components/sections/AccountBanner.js";

const actions = vi.hoisted(() => ({
    deactivateAccount: vi.fn(async () => ({ ok: true as const })),
    reactivateAccount: vi.fn(async () => ({ ok: false as const, message: "Cancel the deletion first." })),
    requestAccountDeletion: vi.fn(async (email: string) => (email === "me@example.com" ? { ok: true as const } : { ok: false as const, message: "Type your account's email to confirm." })),
    cancelAccountDeletion: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("../../web/lib/accountStatusActions.js", () => actions);

const SINCE = "2026-11-09T10:00:00.000Z";

afterEach(() => vi.unstubAllGlobals());

test("an active account shows Deactivate account, which asks first and does nothing when declined", async () => {
    render(<AccountStatus status={{ status: "active", deactivatedAt: null, deleteAfter: null, onlyAdmin: false }} />);
    expect(screen.getByText(/Active/)).toBeTruthy();
    vi.stubGlobal("confirm", vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true));
    await userEvent.click(screen.getByRole("button", { name: "Deactivate account" }));
    expect(actions.deactivateAccount).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Deactivate account" }));
    expect(actions.deactivateAccount).toHaveBeenCalledTimes(1);
});

test("a deactivated account shows since when, and Reactivate, showing a refusal", async () => {
    render(<AccountStatus status={{ status: "deactivated", deactivatedAt: SINCE, deleteAfter: null, onlyAdmin: false }} />);
    expect(screen.getByText(/Deactivated since 2026-11-09/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Reactivate" }));
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.deletion_pending);
});

test("the banner says a deactivated account is deactivated, and a pending deletion's date, each linking to the Account tab; an active account has none", () => {
    const { container, rerender } = render(<AccountBanner account={{ deactivatedAt: null, deleteAfter: null }} />);
    expect(container.textContent).toBe("");
    rerender(<AccountBanner account={{ deactivatedAt: SINCE, deleteAfter: null }} />);
    expect(screen.getByText(/Your account is deactivated/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reactivate" }).getAttribute("href")).toBe("/account");
    rerender(<AccountBanner account={{ deactivatedAt: SINCE, deleteAfter: "2026-12-09T10:00:00.000Z" }} />);
    expect(screen.getByText(/will be deleted on 2026-12-09 10:00 UTC/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cancel deletion" }).getAttribute("href")).toBe("/account");
});

test("a pending deletion shows its date and Cancel deletion, and a held one says why", async () => {
    const { rerender } = render(<AccountStatus status={{ status: "pending_deletion", deactivatedAt: SINCE, deleteAfter: "2026-12-09T10:00:00.000Z", onlyAdmin: false }} />);
    expect(screen.getByText(/Will be deleted on 2026-12-09 10:00 UTC/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(actions.cancelAccountDeletion).toHaveBeenCalledTimes(1);
    rerender(<AccountStatus status={{ status: "held", deactivatedAt: SINCE, deleteAfter: "2026-11-01T10:00:00.000Z", onlyAdmin: true }} />);
    expect(screen.getByText(/held: make another admin first/)).toBeTruthy();
});

test("the only admin sees Delete account greyed out with the reason", () => {
    render(<AccountStatus status={{ status: "active", deactivatedAt: null, deleteAfter: null, onlyAdmin: true }} />);
    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(MESSAGES.last_admin_delete)).toBeTruthy();
});

test("Delete account shows what goes and asks for the email, showing a mismatch", async () => {
    render(<AccountStatus status={{ status: "deactivated", deactivatedAt: SINCE, deleteAfter: null, onlyAdmin: false }} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText(/Deleting removes your jobs and their scores/)).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Your account's email"), "wrong@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(actions.requestAccountDeletion).toHaveBeenCalledWith("wrong@example.com");
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.email_mismatch);
});
