import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { AdminSection } from "../../web/components/settings/AdminSection.js";

const actions = vi.hoisted(() => ({
    makeAccountCodeNow: vi.fn(async () => ({ ok: true as const, code: "Zq3-code-shown-once", expiresAt: "2026-11-13T10:00:00.000Z" })),
    setAdminMark: vi.fn(async () => ({ ok: false as const, message: "Keep at least one admin." })),
    adminChangeEmail: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("../../web/lib/adminActions.js", () => actions);

const ACCOUNTS = [
    { id: 1, name: "Zac", email: "zac@forthebrew.com", isAdmin: true, deactivatedAt: null, deleteAfter: null },
    { id: 2, name: "Ada", email: "ada@example.com", isAdmin: false, deactivatedAt: null, deleteAfter: null },
];

test("the admin section shows a new code once with its expiry, lists accounts with their admin controls, and shows a refusal", async () => {
    render(<AdminSection accounts={ACCOUNTS} />);
    await userEvent.click(screen.getByRole("button", { name: "Make account creation code" }));
    expect((await screen.findByText("Zq3-code-shown-once")).tagName).toBe("CODE");
    expect(screen.getByText(/2026-11-13/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("button").map((button) => button.textContent))).toEqual([
        ["Remove admin", "Change email"],
        ["Make admin", "Change email"],
    ]);
    await userEvent.click(within(rows[0] as HTMLElement).getByRole("button", { name: "Remove admin" }));
    expect(actions.setAdminMark).toHaveBeenCalledWith(1, false);
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.last_admin);
});
