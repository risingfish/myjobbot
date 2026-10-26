import { expect, test } from "vitest";
import { gmailSettings, settingsView } from "../src/web/settingsView.js";
import { TEST_SEARCH } from "./helpers/config.js";

const STRIPE = { name: "Stripe", ats: "greenhouse", slug: "stripe" };

test("stored values are shown as stored and not marked default", () => {
    const { fields } = settingsView({ companies: [STRIPE], match_threshold: 60, preferences: "Remote" }, false);
    expect([fields.companies, fields.match_threshold, fields.preferences]).toEqual([
        { value: [STRIPE], isDefault: false },
        { value: 60, isDefault: false },
        { value: "Remote", isDefault: false },
    ]);
});

test("with nothing stored, every field shows its default, marked", () => {
    const { fields } = settingsView(null, false);
    expect([fields.match_threshold, fields.preferences, fields.companies, fields.searches, fields.title_boosts, fields.exclude_companies]).toEqual([
        { value: 70, isDefault: true },
        { value: "", isDefault: true },
        { value: [], isDefault: true },
        { value: [], isDefault: true },
        { value: [], isDefault: true },
        { value: [], isDefault: true },
    ]);
});

test("each title filter list has its own default", () => {
    const { fields } = settingsView({ title_filter: { extra_exclude: ["staff"] } }, false);
    expect(fields.extra_exclude).toEqual({ value: ["staff"], isDefault: false });
    expect(fields.include.isDefault).toBe(true);
    expect(fields.include.value).toContain("engineer");
    expect(fields.exclude.value).toContain("intern");
});

test("a value that fell back whole shows its default, marked", () => {
    expect(settingsView({ match_threshold: 150 }, false).fields.match_threshold).toEqual({ value: 70, isDefault: true });
});

test("a list with one bad entry shows the others, not marked default", () => {
    expect(settingsView({ companies: [STRIPE, { name: "X", ats: "workday", slug: "x" }] }, false).fields.companies).toEqual({ value: [STRIPE], isDefault: false });
});

test("entries are kept as stored, with their blank fields left out", () => {
    expect(settingsView({ searches: [{ name: "Remote", query: "backend" }] }, false).fields.searches.value).toEqual([{ name: "Remote", query: "backend" }]);
});

test("a source is needed until a company or a search is in effect", () => {
    expect([settingsView(null, false).needsSource, settingsView({ companies: [STRIPE] }, false).needsSource, settingsView({ searches: [TEST_SEARCH] }, true).needsSource]).toEqual([true, false, false]);
});

test("the JSearch key is needed only while searches are in effect without one", () => {
    const searching = { searches: [TEST_SEARCH] };
    expect([settingsView(searching, false).needsSearchKey, settingsView(searching, true).needsSearchKey, settingsView({ companies: [STRIPE] }, false).needsSearchKey]).toEqual([true, false, false]);
});

test("title boosts come as rows in the stored order, and excluded publishers from their stored key", () => {
    const { fields } = settingsView({ title_boosts: { typescript: 10, golang: 5 }, exclude_publishers: ["jobmesh.io"] }, false);
    expect([fields.title_boosts.value, fields.exclude_publishers]).toEqual([
        [
            ["typescript", 10],
            ["golang", 5],
        ],
        { value: ["jobmesh.io"], isDefault: false },
    ]);
    expect(settingsView(null, false).fields.exclude_publishers).toEqual({ value: [], isDefault: true });
});

test("the Gmail alert senders come from config.json's runtime settings, with their default, when no source is set", () => {
    expect(gmailSettings({ gmail: { alert_senders: ["alerts@example.com"] } }).alert_senders).toEqual(["alerts@example.com"]);
    expect(gmailSettings({}).alert_senders.length).toBeGreaterThan(0);
});
