import { expect, test } from "vitest";
import { SECTIONS } from "../src/web/settingsSections.js";

const SEARCH_KEYS = ["companies", "searches", "preferences", "match_threshold", "title_filter", "title_boosts", "exclude_companies", "exclude_publishers"];

test("the ten fields cover the eight search keys, each in one section, with no check path twice", () => {
    expect(SECTIONS).toHaveLength(10);
    expect([...new Set(SECTIONS.map((field) => field.stored[0]))].sort()).toEqual([...SEARCH_KEYS].sort());
    expect(new Set(SECTIONS.map((field) => field.name)).size).toBe(10);
    expect(new Set(SECTIONS.map((field) => field.check.join("."))).size).toBe(10);
    expect(new Set(SECTIONS.map((field) => field.section))).toEqual(new Set(["sources", "preferences", "scoring", "filters"]));
});
