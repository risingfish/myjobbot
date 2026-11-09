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
