import { expect, test } from "vitest";
import { alertQuery, newestFirst, summarize } from "../src/gmail/alerts.js";
import { testFileConfig } from "./helpers/config.js";

test("the alert search names every sender and looks back 7 days", () => {
    expect(alertQuery(["a@x.com", "y.org"])).toBe("from:(a@x.com OR y.org) newer_than:7d");
});

test("alert senders are emails or domains, defaulting to LinkedIn and Indeed alerts", () => {
    expect(testFileConfig().gmail.alert_senders).toEqual(["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com", "alert@indeed.com", "donotreply@jobalert.indeed.com"]);
    expect(testFileConfig({ gmail: { alert_senders: ["Jobs@Example.com", "mail.example.org"] } }).gmail.alert_senders).toHaveLength(2);
    for (const bad of ['"a@x.com"', "a b.com", "(x.com)", "-x.com", "", "x"]) {
        expect(() => testFileConfig({ gmail: { alert_senders: [bad] } })).toThrow(/alert sender/);
    }
});

test("a message's headers become its sender, subject and date", () => {
    const headers = [
        { name: "From", value: "LinkedIn <jobalerts-noreply@linkedin.com>" },
        { name: "Date", value: "Wed, 15 Oct 2026 09:00:00 -0700" },
    ];
    expect(summarize(headers)).toEqual({ from: "LinkedIn <jobalerts-noreply@linkedin.com>", subject: "(no subject)", date: "Wed, 15 Oct 2026 09:00:00 -0700" });
});

test("alerts are listed newest first, keeping Gmail's order when a date can't be read", () => {
    const at = (subject: string, date: string) => ({ from: "x", subject, date });
    expect(newestFirst([at("old", "Mon, 13 Oct 2026 09:00:00 +0000"), at("new", "Wed, 15 Oct 2026 09:00:00 +0000")]).map((alert) => alert.subject)).toEqual(["new", "old"]);
    expect(newestFirst([at("first", "garbage"), at("second", "also garbage")]).map((alert) => alert.subject)).toEqual(["first", "second"]);
});
