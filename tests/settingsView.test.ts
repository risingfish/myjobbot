import { expect, test } from "vitest";
import { gmailSettings, settingsView } from "../src/web/settingsView.js";

test("stored values are shown as stored and not marked default", () => {
    const { fields } = settingsView({ exclude_companies: ["acme"], match_threshold: 60, preferences: "Remote" });
    expect([fields.exclude_companies, fields.match_threshold, fields.preferences]).toEqual([
        { value: ["acme"], isDefault: false },
        { value: 60, isDefault: false },
        { value: "Remote", isDefault: false },
    ]);
});

test("with nothing stored, every field shows its default, marked", () => {
    const { fields } = settingsView(null);
    expect([fields.match_threshold, fields.preferences, fields.title_boosts, fields.exclude_companies]).toEqual([
        { value: 70, isDefault: true },
        { value: "", isDefault: true },
        { value: [], isDefault: true },
        { value: [], isDefault: true },
    ]);
});

test("each title filter list has its own default", () => {
    const { fields } = settingsView({ title_filter: { extra_exclude: ["staff"] } });
    expect(fields.extra_exclude).toEqual({ value: ["staff"], isDefault: false });
    expect(fields.include.isDefault).toBe(true);
    expect(fields.include.value).toContain("engineer");
    expect(fields.exclude.value).toContain("intern");
});

test("a value that fell back whole shows its default, marked", () => {
    expect(settingsView({ match_threshold: 150 }).fields.match_threshold).toEqual({ value: 70, isDefault: true });
});

test("a list with one bad entry shows the others, not marked default", () => {
    expect(settingsView({ exclude_companies: ["acme", "--"] }).fields.exclude_companies).toEqual({ value: ["acme"], isDefault: false });
});

test("title boosts come as rows in the stored order, and excluded publishers from their stored key", () => {
    const { fields } = settingsView({ title_boosts: { typescript: 10, golang: 5 }, exclude_publishers: ["jobmesh.io"] });
    expect([fields.title_boosts.value, fields.exclude_publishers]).toEqual([
        [
            ["typescript", 10],
            ["golang", 5],
        ],
        { value: ["jobmesh.io"], isDefault: false },
    ]);
    expect(settingsView(null).fields.exclude_publishers).toEqual({ value: [], isDefault: true });
});

test("the Gmail alert senders come from config.json's runtime settings, with their default, when no source is set", () => {
    expect(gmailSettings({ gmail: { alert_senders: ["alerts@example.com"] } }).alert_senders).toEqual(["alerts@example.com"]);
    expect(gmailSettings({}).alert_senders.length).toBeGreaterThan(0);
});
