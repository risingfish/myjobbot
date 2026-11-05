import { expect, test } from "vitest";
import { withDescriptionBoosts } from "../src/config/boostCarryOver.js";

test("the title boosts are copied into description boosts, the document's keys kept in order", () => {
    const next = withDescriptionBoosts({ preferences: "x", title_boosts: { go: 5 } });
    expect(next).toEqual({ preferences: "x", title_boosts: { go: 5 }, description_boosts: { go: 5 } });
    expect(Object.keys(next ?? {})).toEqual(["preferences", "title_boosts", "description_boosts"]);
});

test("a document without title boosts is left alone", () => {
    expect(withDescriptionBoosts({ preferences: "x" })).toBeNull();
});

test("a document that already has description boosts, even none, is left alone", () => {
    expect(withDescriptionBoosts({ title_boosts: { go: 5 }, description_boosts: {} })).toBeNull();
});

test("title boosts that aren't an object are left alone", () => {
    expect(withDescriptionBoosts({ title_boosts: ["go"] })).toBeNull();
});
