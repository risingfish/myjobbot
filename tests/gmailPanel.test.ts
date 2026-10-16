import { expect, test } from "vitest";
import { gmailPanelView } from "../src/web/gmailPanel.js";
import { gmailRow } from "./helpers/gmailRows.js";

const OK = { keyStatus: "ok" as const, keyChanged: false };

test("without a usable key nothing is offered, and with nothing saved only Connect is", () => {
    for (const keyStatus of ["missing", "invalid"] as const) {
        const view = gmailPanelView(gmailRow(), { ...OK, keyStatus });
        expect(view.offers).toEqual([]);
        expect(view.message).toContain("MYJOBBOT_SECRET_KEY");
        expect(view.message).toContain("restart the dev server");
    }
    const empty = gmailPanelView(null, OK);
    expect([empty.state, empty.offers]).toEqual(["none", ["connect"]]);
    expect(empty.message).toContain("https://myaccount.google.com/apppasswords");
});

test("a connection offers Check now, Disconnect and replacing it; needing to reconnect offers the form", () => {
    const connected = gmailPanelView(gmailRow(), OK);
    expect([connected.state, connected.offers, connected.email, connected.message, connected.lastRun]).toEqual(["connected", ["check", "disconnect", "replace"], "me@example.com", null, null]);
    const counts = { uid_validity: 7, last_uid: 9, last_run_at: "2026-10-16T08:05:00.000Z", emails_read: 3, jobs_found: 14, not_understood: 1 };
    expect(gmailPanelView(gmailRow(), { ...OK, alertState: counts }).lastRun).toMatch(/^Last run 2026-10-1[56] \d\d:\d\d: 3 alert emails, 14 jobs, 1 not understood$/);
    expect(gmailPanelView(gmailRow(), { ...OK, alertState: { ...counts, emails_read: 1, jobs_found: 1 } }).lastRun).toContain(": 1 alert email, 1 job, 1 not understood");
    expect(gmailPanelView(null, { ...OK, alertState: counts }).lastRun).toBeNull();
    expect(connected.connectedAt).toMatch(/^2026-10-1[56] \d\d:\d\d$/);
    const stale = gmailPanelView(gmailRow({ status: "needs_reconnect", reason: "app password rejected; create a new one" }), OK);
    expect([stale.offers, stale.reason]).toEqual([["connect", "disconnect"], "app password rejected; create a new one"]);
    expect(Object.keys(connected)).not.toContain("appPassword");
});

test("a changed server key asks for the app password again", () => {
    const view = gmailPanelView(gmailRow(), { ...OK, keyChanged: true });
    expect([view.state, view.message, view.offers]).toEqual(["key_changed", "Server key changed; enter the app password again", ["connect"]]);
});
