import { expect, test } from "vitest";
import { addRow, editedField, removeRow, resetField, saveRequest, sectionRequest, updateRow } from "../src/web/settingsForm.js";

const BOOSTS = { value: [["go", 5] as [string, number]], isDefault: false };

test("adding a row appends it, and the list stops being the default", () => {
    expect(addRow({ value: ["engineer"], isDefault: true }, "developer")).toEqual({ value: ["engineer", "developer"], isDefault: false });
});

test("removing a row drops the row at its index", () => {
    expect(removeRow({ value: ["a", "b", "c"], isDefault: false }, 1)).toEqual({ value: ["a", "c"], isDefault: false });
});

test("updating a row changes only that row", () => {
    expect(updateRow(BOOSTS, 0, ["go", 8])).toEqual({ value: [["go", 8]], isDefault: false });
});

test("resetting a field puts its default back, marked", () => {
    expect(resetField(70)).toEqual({ value: 70, isDefault: true });
});

test("editing a field clears its default marker", () => {
    expect(editedField(75)).toEqual({ value: 75, isDefault: false });
});

test("a section's request sends an untouched default field as default and every other field as its value (SC-007)", () => {
    expect(sectionRequest("scoring", { match_threshold: { value: 70, isDefault: true }, title_boosts: BOOSTS })).toEqual({
        section: "scoring",
        edits: { match_threshold: { kind: "default" }, title_boosts: { kind: "value", value: [["go", 5]] } },
    });
});

test("a request for an unknown section is refused, and a well-formed one passes", () => {
    expect(saveRequest.safeParse({ section: "http", edits: {} }).success).toBe(false);
    expect(saveRequest.safeParse({ section: "preferences", edits: { preferences: { kind: "value", value: "Remote" } } }).success).toBe(true);
});

test("a request holding another section's field is refused", () => {
    expect(saveRequest.safeParse({ section: "preferences", edits: { preferences: { kind: "default" }, match_threshold: { kind: "value", value: 70 } } }).success).toBe(false);
});

test("a row with extra keys is refused rather than stored", () => {
    const companies = { kind: "value", value: [{ name: "Stripe", ats: "greenhouse", slug: "stripe", admin: true }] };
    expect(saveRequest.safeParse({ section: "sources", edits: { companies, searches: { kind: "default" } } }).success).toBe(false);
});
