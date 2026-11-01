import { expect, test } from "vitest";
import { alertQuery, newestFirst, newestUids, summarize } from "../src/gmail/alerts.js";
import { testAppSettings } from "./helpers/config.js";

test("the alert search names every sender and looks back 7 days", () => {
    expect(alertQuery(["a@x.com", "y.org"])).toBe("from:(a@x.com OR y.org) newer_than:7d");
});

test("alert senders are emails or domains, defaulting to LinkedIn and Indeed alerts", () => {
    expect(testAppSettings().gmail.alert_senders).toEqual(["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com", "alert@indeed.com", "donotreply@jobalert.indeed.com"]);
    expect(testAppSettings({ gmail: { alert_senders: ["Jobs@Example.com", "mail.example.org"] } }).gmail.alert_senders).toHaveLength(2);
    for (const bad of ['"a@x.com"', "a b.com", "(x.com)", "-x.com", "", "x"]) {
        expect(() => testAppSettings({ gmail: { alert_senders: [bad] } })).toThrow(/alert sender/);
    }
});

test("a message's envelope becomes its sender, subject and date", () => {
    const envelope = { from: [{ name: "LinkedIn", address: "jobalerts-noreply@linkedin.com" }], date: new Date("2026-10-15T16:00:00.000Z") };
    expect(summarize(envelope)).toEqual({ from: "LinkedIn <jobalerts-noreply@linkedin.com>", subject: "(no subject)", date: "2026-10-15T16:00:00.000Z" });
    expect(summarize({ from: [{ address: "a@x.com" }], subject: "Jobs", date: "garbage" })).toEqual({ from: "a@x.com", subject: "Jobs", date: "garbage" });
});

test("the newest messages are the highest UIDs, and alerts are listed newest first", () => {
    expect(newestUids([3, 9, 1, 12, 7, 5, 11])).toEqual([12, 11, 9, 7, 5]);
    const at = (subject: string, date: string) => ({ from: "x", subject, date });
    expect(newestFirst([at("old", "2026-10-13T09:00:00Z"), at("new", "2026-10-15T09:00:00Z")]).map((alert) => alert.subject)).toEqual(["new", "old"]);
    expect(newestFirst([at("first", "garbage"), at("second", "also garbage")]).map((alert) => alert.subject)).toEqual(["first", "second"]);
});
