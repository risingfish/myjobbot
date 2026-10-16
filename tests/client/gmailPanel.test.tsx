import { randomBytes } from "node:crypto";
import { within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { GmailConnectionRow } from "../../src/db/store.js";
import { seal } from "../../src/gmail/seal.js";
import { gmailPanelView } from "../../src/web/gmailPanel.js";
import { GmailPanel } from "../../web/components/settings/GmailPanel.js";
import { gmailRow } from "../helpers/gmailRows.js";

const actions = vi.hoisted(() => ({ connectGmail: vi.fn(), checkGmail: vi.fn(), disconnectGmail: vi.fn() }));

vi.mock("../../web/lib/gmailActions.js", () => actions);

const PLAIN = "abcdefghijklmnop";

beforeEach(() => {
    actions.connectGmail.mockReset().mockResolvedValue({ ok: false, error: "Gmail rejected the address or app password." });
    actions.checkGmail.mockReset().mockResolvedValue({ ok: true, count: 3, newest: [{ from: "LinkedIn", subject: "5 new jobs", date: "2026-10-15T09:00:00.000Z" }] });
    actions.disconnectGmail.mockReset().mockResolvedValue({ ok: true });
});

const LAST_RUN = { uid_validity: 7, last_uid: 9, last_run_at: "2026-10-16T08:05:00.000Z", emails_read: 3, jobs_found: 14, not_understood: 1 };

function renderPanel(row: GmailConnectionRow | null) {
    return render(<GmailPanel view={gmailPanelView(row, { keyStatus: "ok", keyChanged: false, alertState: LAST_RUN })} />).container;
}

async function disconnectAnswering(answer: boolean, panel: HTMLElement) {
    Object.defineProperty(window, "confirm", { value: () => answer, configurable: true });
    await userEvent.click(within(panel).getByRole("button", { name: "Disconnect" }));
}

test("the connect form never shows the app password, and a refused connect says why", async () => {
    const sealed = seal(PLAIN, "app_password", randomBytes(32));
    const connected = renderPanel(gmailRow({ app_password: sealed }));
    expect(connected.innerHTML).not.toContain(sealed);
    expect(connected.innerHTML).not.toContain(PLAIN);
    const empty = renderPanel(null);
    const password = empty.querySelector<HTMLInputElement>("input[name=app_password]");
    expect([password?.value, password?.type, password?.getAttribute("autocomplete")]).toEqual(["", "password", "off"]);
    await userEvent.click(within(empty).getByRole("button", { name: "Connect" }));
    expect((await within(empty).findByRole("alert")).textContent).toBe("Gmail rejected the address or app password.");
});

test("a connected panel names the address and time, and one needing to reconnect says why", () => {
    const connected = renderPanel(gmailRow());
    expect(within(connected).getByText(/Connected as me@example.com since 2026-10-1[56]/)).toBeTruthy();
    expect(within(connected).getByText(/3 alert emails, 14 jobs, 1 not understood/)).toBeTruthy();
    expect(within(connected).getByText("Use a different account or app password")).toBeTruthy();
    const stale = renderPanel(gmailRow({ status: "needs_reconnect", reason: "app password rejected; create a new one" }));
    expect(within(stale).getByText(/Needs reconnecting: app password rejected; create a new one/)).toBeTruthy();
    expect(within(stale).getByRole("button", { name: "Connect" })).toBeTruthy();
});

test("a connected panel checks the mailbox, and disconnects only after confirming", async () => {
    const panel = renderPanel(gmailRow());
    await userEvent.click(within(panel).getByRole("button", { name: "Check now" }));
    expect(await within(panel).findByText(/3 job-alert emails in the last 7 days/)).toBeTruthy();
    expect(within(panel).getByText(/5 new jobs/)).toBeTruthy();
    await disconnectAnswering(false, panel);
    expect(actions.disconnectGmail).not.toHaveBeenCalled();
    await disconnectAnswering(true, panel);
    expect(actions.disconnectGmail).toHaveBeenCalledOnce();
});
