import { randomBytes } from "node:crypto";
import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { GmailConnectionRow } from "../../src/db/store.js";
import { seal } from "../../src/gmail/seal.js";
import { gmailPanelView } from "../../src/web/gmailPanel.js";
import { GmailPanel } from "../../web/components/settings/GmailPanel.js";
import { gmailRow } from "../helpers/gmailRows.js";

const actions = vi.hoisted(() => ({ saveGmailCredentials: vi.fn(), clearGmailCredentials: vi.fn(), connectGmail: vi.fn() }));

vi.mock("../../web/lib/gmailActions.js", () => actions);

const KEY = randomBytes(32);
const PLAIN = "plain-secret-value-123";

beforeEach(() => {
    actions.saveGmailCredentials.mockReset().mockResolvedValue({ ok: false, error: "The client secret must be 1–255 characters." });
});

function renderPanel(row: GmailConnectionRow | null, options: { host?: string; notice?: string } = {}) {
    const view = gmailPanelView(row, { keyStatus: "ok", keyChanged: false, host: options.host ?? "localhost:8080" });
    return render(<GmailPanel view={view} notice={options.notice ?? null} />);
}

test("saved credentials show the client ID but never the secret, and a refused save shows why", async () => {
    const sealed = seal(PLAIN, "client_secret", KEY);
    const { container } = renderPanel(gmailRow({ client_secret: sealed }));
    expect(screen.getByText(/client-1/)).toBeTruthy();
    expect(screen.getByText(/secret saved/)).toBeTruthy();
    const secret = container.querySelector<HTMLInputElement>("input[name=client_secret]");
    expect([secret?.value, secret?.type, secret?.getAttribute("autocomplete")]).toEqual(["", "password", "off"]);
    expect(container.innerHTML).not.toContain(sealed);
    expect(container.innerHTML).not.toContain(PLAIN);
    const empty = renderPanel(null);
    await userEvent.click(within(empty.container).getByRole("button", { name: "Save" }));
    expect((await within(empty.container).findByRole("alert")).textContent).toBe("The client secret must be 1–255 characters.");
});

test("a connected panel names the address and time, and a sign-in outcome shows its fixed text", () => {
    const connected = renderPanel(gmailRow({ status: "connected", email: "me@example.com", connected_at: "2026-10-15T20:00:00.000Z" }), { notice: "That sign-in link expired or was already used; try again." });
    expect(within(connected.container).getByText(/Connected as me@example.com since 2026-10-15/)).toBeTruthy();
    expect(within(connected.container).getByRole("status").textContent).toBe("That sign-in link expired or was already used; try again.");
    const lan = renderPanel(gmailRow(), { host: "192.168.1.20:8080" });
    expect(within(lan.container).getByRole("button", { name: "Connect Gmail" })).toHaveProperty("disabled", true);
    expect(within(lan.container).getByText("Open Settings at http://localhost:8080 to connect")).toBeTruthy();
});
