import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import { AccountView } from "../../web/components/account/AccountView.js";

const actions = vi.hoisted(() => ({
    saveName: vi.fn(async () => ({ ok: true as const })),
    changePassword: vi.fn(async () => ({ ok: true as const })),
    setMethodEnabled: vi.fn(async () => ({ ok: false as const, message: "Keep at least one way to sign in turned on and set up." })),
    signOutEverywhereElse: vi.fn(async () => ({ ok: true as const })),
    signOutDevice: vi.fn(async () => ({ ok: true as const })),
    confirmIdentity: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("../../web/lib/accountActions.js", () => actions);

const STATE = {
    name: "Zac",
    email: "zac@forthebrew.com",
    ways: [
        { kind: "password" as const, enabled: true, ready: true, usable: true },
        { kind: "email_link" as const, enabled: false, ready: false, usable: false },
        { kind: "hardware_key" as const, enabled: false, ready: false, usable: false },
        { kind: "authenticator" as const, enabled: false, ready: false, usable: false },
    ],
    signIns: [
        { ref: "aaaaaaaaaaaaaaaa", current: true, os: "Linux", ip: "192.168.2.101", location: "Local network", lastUsedAt: "2026-11-06T10:00:00.000Z" },
        { ref: "bbbbbbbbbbbbbbbb", current: false, os: "iOS", ip: "203.0.113.9", location: "Seattle, WA, US", lastUsedAt: "2026-11-05T09:00:00.000Z" },
    ],
    events: [{ at: "2026-11-06T10:00:00.000Z", label: "Signed in", method: "password" }],
};

async function waysShownOnlyWhileOn() {
    const switches = screen.getAllByRole("switch");
    expect(switches.map((box) => (box as HTMLInputElement).checked)).toEqual([true, false, false, false]);
    expect(screen.getAllByText("Not set up")).toHaveLength(3);
    expect(switches.map((box) => (box as HTMLInputElement).disabled)).toEqual([true, false, false, false]);
    expect(screen.getByText("Your only way to sign in, so it stays on")).toBeTruthy();
    expect(screen.getByLabelText("Current password")).toBeTruthy();
    expect(screen.queryByText(/comes in a later update/)).toBeNull();
    expect(document.querySelector("details")).toBeNull();
    await userEvent.click(switches[0] as HTMLElement);
    expect(actions.setMethodEnabled).not.toHaveBeenCalled();
    await userEvent.click(switches[3] as HTMLElement);
    expect(actions.setMethodEnabled).toHaveBeenCalledWith("authenticator", true);
    expect((await screen.findByRole("alert")).textContent).toBe(MESSAGES.last_way);
}

async function signInsListed() {
    const rows = within(screen.getByRole("table", { name: "Sign-ins" })).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(["Linux192.168.2.101Local network2026-11-06 10:00 UTCThis device", "iOS203.0.113.9Seattle, WA, US2026-11-05 09:00 UTCSign out"]);
    await userEvent.click(within(rows[1] as HTMLElement).getByRole("button", { name: "Sign out" }));
    expect(actions.signOutDevice).toHaveBeenCalledWith("bbbbbbbbbbbbbbbb");
}

test("the Account tab shows User Profile, the four ways with each one's controls only while it is on, the only usable way locked on, each sign-in with its device and a Sign out, and recent events", async () => {
    render(<AccountView state={STATE} />);
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["User Profile", "Ways of signing in", "Sign-ins", "Recent activity"]);
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Zac");
    expect(screen.getByText("zac@forthebrew.com")).toBeTruthy();
    await waysShownOnlyWhileOn();
    await signInsListed();
    expect(within(screen.getByRole("table", { name: "Recent activity" })).getByText("Signed in")).toBeTruthy();
});
