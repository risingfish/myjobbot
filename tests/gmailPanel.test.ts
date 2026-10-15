import { expect, test } from "vitest";
import { gmailPanelView } from "../src/web/gmailPanel.js";
import { gmailRow } from "./helpers/gmailRows.js";

const LOCAL = { keyStatus: "ok" as const, keyChanged: false, host: "localhost:8080" };

test("without a usable key nothing is offered, and without credentials only Save is", () => {
    for (const keyStatus of ["missing", "invalid"] as const) {
        const view = gmailPanelView(gmailRow(), { ...LOCAL, keyStatus });
        expect(view.offers).toEqual([]);
        expect(view.message).toContain("MYJOBBOT_SECRET_KEY");
        expect(view.message).toContain("restart the dev server");
    }
    const empty = gmailPanelView(null, LOCAL);
    expect([empty.offers, empty.secretSaved, empty.message]).toEqual([["save"], false, null]);
});

test("saved credentials can connect only from a loopback address", () => {
    const local = gmailPanelView(gmailRow(), LOCAL);
    expect([local.clientId, local.secretSaved, local.canConnect, local.connectHint]).toEqual(["client-1", true, true, null]);
    expect(local.offers).toEqual(["connect", "replace", "clear"]);
    const lan = gmailPanelView(gmailRow(), { ...LOCAL, host: "192.168.1.20:8080" });
    expect([lan.canConnect, lan.connectHint]).toEqual([false, "Open Settings at http://localhost:8080 to connect"]);
    expect(Object.keys(local)).not.toContain("clientSecret");
});

test("a changed server key asks for the client secret again", () => {
    const view = gmailPanelView(gmailRow({ status: "connected", email: "me@example.com" }), { ...LOCAL, keyChanged: true });
    expect([view.state, view.message, view.offers, view.canConnect]).toEqual(["key_changed", "Server key changed; enter the client secret again", ["save"], false]);
});
