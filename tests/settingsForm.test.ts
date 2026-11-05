import { expect, test } from "vitest";
import { addTerm, editedField, putBoost, removeRow, saveRequest, sectionRequest } from "../src/web/settingsForm.js";

const BOOSTS = { value: [["go", 5] as [string, number]], isDefault: false };

test("adding a term trims it, and a blank term or one already listed, in any case, changes nothing", () => {
    const terms = { value: ["engineer"], isDefault: true };
    expect(addTerm(terms, "  Developer ")).toEqual({ value: ["engineer", "Developer"], isDefault: false });
    expect([addTerm(terms, "   "), addTerm(terms, " Engineer")]).toEqual([terms, terms]);
});

test("putting a boost adds it trimmed, updates the points of a term already boosted in any case, and ignores a blank term", () => {
    const boosts = { value: [["go", 5] as [string, number]], isDefault: true };
    expect(putBoost(boosts, [" TypeScript ", 10], null)).toEqual({
        value: [
            ["go", 5],
            ["TypeScript", 10],
        ],
        isDefault: false,
    });
    expect(putBoost(boosts, ["Go", 8], null)).toEqual({ value: [["Go", 8]], isDefault: false });
    expect(putBoost(boosts, ["  ", 10], null)).toBe(boosts);
});

test("putting a boost at an index replaces that boost", () => {
    const boosts = {
        value: [
            ["go", 5],
            ["rust", 3],
        ] as Array<[string, number]>,
        isDefault: false,
    };
    expect(putBoost(boosts, ["golang ", 7], 0)).toEqual({
        value: [
            ["golang", 7],
            ["rust", 3],
        ],
        isDefault: false,
    });
});

test("removing a row drops the row at its index", () => {
    expect(removeRow({ value: ["a", "b", "c"], isDefault: false }, 1)).toEqual({ value: ["a", "c"], isDefault: false });
});

test("editing a field clears its default marker", () => {
    expect(editedField(75)).toEqual({ value: 75, isDefault: false });
});

test("a section's request sends an untouched default field as default and every other field as its value (SC-007)", () => {
    expect(sectionRequest("scoring", { match_threshold: { value: 70, isDefault: true }, title_boosts: BOOSTS })).toEqual({
        section: "scoring",
        edits: { match_threshold: { kind: "default" }, resume_view: { kind: "default" }, title_boosts: { kind: "value", value: [["go", 5]] }, description_boosts: { kind: "default" } },
    });
});

test("a request for an unknown section is refused, and a well-formed one passes", () => {
    expect(saveRequest.safeParse({ section: "http", edits: {} }).success).toBe(false);
    expect(saveRequest.safeParse({ section: "preferences", edits: { preferences: { kind: "value", value: "Remote" } } }).success).toBe(true);
});

test("a request holding another section's field is refused", () => {
    expect(saveRequest.safeParse({ section: "preferences", edits: { preferences: { kind: "default" }, match_threshold: { kind: "value", value: 70 } } }).success).toBe(false);
});

test("a row with extra parts is refused rather than stored", () => {
    const title_boosts = { kind: "value", value: [["go", 5, "admin"]] };
    expect(saveRequest.safeParse({ section: "scoring", edits: { match_threshold: { kind: "default" }, title_boosts, description_boosts: { kind: "default" } } }).success).toBe(false);
});
