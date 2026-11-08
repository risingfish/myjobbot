import { expect, test } from "vitest";
import { enableProblem, saveSourcePlan, scheduledElsewhere, scheduledSearches } from "../src/web/sourceRules.js";
import { savedSources } from "./helpers/savedSources.js";

const BUDGET = "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours";
const LIMITS = { monthly_request_cap: 190, refresh_hours: 24 };
const searches = (names: string[]) => names.map((query) => ({ name: query, query }));

test("turning a search on counts the searches other users have on against the one budget", () => {
    const saved = savedSources({ searches: searches(["a", "b", "c", "d", "e"]) }).map((source) => (source.name === "e" ? { ...source, enabled: false } : source));
    const off = saved.find((source) => source.name === "e")?.id ?? 0;
    expect([enableProblem(saved, off, LIMITS, 2), enableProblem(saved, off, LIMITS, 1)]).toEqual([BUDGET, null]);
});

test("saving a new search counts the searches other users have on against the one budget", () => {
    const facts = { saved: savedSources({ searches: searches(["a", "b", "c", "d", "e"]) }), limits: LIMITS, met: { jsearch_key: true, gmail: true } };
    const search = { id: null, module: "jsearch", name: "f", values: { query: "f" } };
    expect(saveSourcePlan(search, { ...facts, elsewhere: 1 })).toEqual({ problems: [{ field: null, entry: null, message: BUDGET }] });
    expect(saveSourcePlan(search, { ...facts, elsewhere: 0 })).toMatchObject({ source: { target: "jsearch:f|us|false" } });
});

test("the alert lookups' reserve counts every user's scheduled searches, and the rules count other users' apart", () => {
    const all = [
        { userId: 1, module: "jsearch" },
        { userId: 1, module: "greenhouse" },
        { userId: 2, module: "jsearch" },
        { userId: 2, module: "jsearch" },
    ];
    expect([scheduledSearches(all), scheduledElsewhere(all, 1), scheduledElsewhere(all, 2)]).toEqual([3, 2, 1]);
});
