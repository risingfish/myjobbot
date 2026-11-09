import { expect, test } from "vitest";
import { gmailSettings } from "../src/config/runtimeParts.js";

test("the Gmail alert senders come from config.json's runtime settings, with their default, when no source is set", () => {
    expect(gmailSettings({ gmail: { alert_senders: ["alerts@example.com"] } }).alert_senders).toEqual(["alerts@example.com"]);
    expect(gmailSettings({}).alert_senders.length).toBeGreaterThan(0);
});
