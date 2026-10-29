import { expect, test } from "vitest";
import { applySection } from "../src/web/settingsApply.js";
import type { SaveRequest } from "../src/web/settingsForm.js";

const value = (v: unknown) => ({ kind: "value" as const, value: v });
const DEFAULT = { kind: "default" as const };

function scoring(threshold: unknown, boosts: unknown = DEFAULT): SaveRequest {
    return { section: "scoring", edits: { match_threshold: threshold === DEFAULT ? DEFAULT : value(threshold), title_boosts: boosts === DEFAULT ? DEFAULT : value(boosts) } };
}

test("a save replaces only its section's fields and keeps the others exactly as stored, a fallen-back value included", () => {
    const stored = { exclude_companies: ["acme"], preferences: 5, match_threshold: 60 };
    expect(applySection(stored, scoring(75)).toStore).toEqual({ exclude_companies: ["acme"], preferences: 5, match_threshold: 75 });
});

test("a field edited to its default is removed from the stored document", () => {
    expect(applySection({ exclude_companies: ["acme"], match_threshold: 60, title_boosts: { go: 5 } }, scoring(DEFAULT)).toStore).toEqual({ exclude_companies: ["acme"] });
});

test("keys that aren't search settings are dropped from the document to store", () => {
    expect(applySection({ exclude_companies: ["acme"], http: { timeout_s: 20 } }, scoring(70)).toStore).toEqual({ exclude_companies: ["acme"], match_threshold: 70 });
});

test("the document to check holds the other sections after fallback, and the section's own values as sent", () => {
    const request: SaveRequest = { section: "preferences", edits: { preferences: value("Remote") } };
    expect(applySection({ exclude_companies: ["acme"], match_threshold: 150 }, request).toCheck).toEqual({ exclude_companies: ["acme"], preferences: "Remote" });
    expect(applySection({ exclude_companies: ["acme"] }, scoring(150)).toCheck).toEqual({ exclude_companies: ["acme"], match_threshold: 150 });
});

test("lists keep exactly the values sent, so resending the stored values stores the same document (SC-006)", () => {
    const stored = { exclude_companies: ["acme"], title_filter: { include: ["go"] } };
    const request: SaveRequest = { section: "filters", edits: { include: value(["go"]), exclude: DEFAULT, extra_exclude: DEFAULT, exclude_companies: value(["acme"]), exclude_publishers: DEFAULT } };
    expect(JSON.stringify(applySection(stored, request).toStore)).toBe(JSON.stringify(stored));
});

test("boost rows become a map in row order", () => {
    const boosts = applySection({ exclude_companies: ["acme"] }, scoring(DEFAULT, [["typescript", 10], ["go", 5]])).toStore.title_boosts;
    expect(Object.entries(boosts as object)).toEqual([["typescript", 10], ["go", 5]]);
});

test("title filter fields are stored inside title_filter, and resetting one leaves the others", () => {
    const request: SaveRequest = { section: "filters", edits: { include: DEFAULT, exclude: DEFAULT, extra_exclude: value(["staff"]), exclude_companies: DEFAULT, exclude_publishers: value(["jobmesh.io"]) } };
    expect(applySection({ preferences: "Remote", title_filter: { include: ["go"], extra_exclude: ["lead"] } }, request).toStore).toEqual({ preferences: "Remote", title_filter: { extra_exclude: ["staff"] }, exclude_publishers: ["jobmesh.io"] });
});

test("a title filter left with no lists is removed whole, and with nothing stored the document comes from the section alone", () => {
    const request: SaveRequest = { section: "filters", edits: { include: DEFAULT, exclude: DEFAULT, extra_exclude: DEFAULT, exclude_companies: value(["acme"]), exclude_publishers: DEFAULT } };
    expect(applySection({ preferences: "Remote", title_filter: { include: ["go"] } }, request).toStore).toEqual({ preferences: "Remote", exclude_companies: ["acme"] });
    expect(applySection(null, scoring(80)).toStore).toEqual({ match_threshold: 80 });
});
