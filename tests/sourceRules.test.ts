import { expect, test } from "vitest";
import { enableProblem, saveSourcePlan } from "../src/web/sourceRules.js";
import { savedSources, STRIPE_BOARD } from "./helpers/savedSources.js";

const BUDGET = "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours";
const LIMITS = { monthly_request_cap: 190, refresh_hours: 24 };
const FACTS = { saved: savedSources({ companies: [STRIPE_BOARD] }), limits: LIMITS, met: { jsearch_key: true, gmail: true } };

function board(name: string, slug = "affirm") {
    return { id: null, module: "greenhouse", name, values: { slug } };
}

function messages(plan: ReturnType<typeof saveSourcePlan>) {
    return "problems" in plan ? plan.problems.map((problem) => [problem.field, problem.message]) : [];
}

test("a name another source has, ignoring case, is refused beside the name", () => {
    expect(messages(saveSourcePlan(board("STRIPE"), FACTS))).toEqual([["name", "a source with this name already exists"]]);
    expect(saveSourcePlan({ ...board("Stripe", "stripe"), id: 1 }, FACTS)).toMatchObject({ source: { id: 1, name: "Stripe", target: "greenhouse:stripe" } });
});

test("Gmail alerts is refused as a name", () => {
    expect(messages(saveSourcePlan(board("gmail alerts"), FACTS))).toEqual([["name", '"Gmail alerts" is a reserved source name']]);
});

test("a second source for the same board is refused, naming the first", () => {
    expect(messages(saveSourcePlan(board("Stripe two", "Stripe"), FACTS))).toEqual([[null, "this board is already saved as Stripe"]]);
    expect(saveSourcePlan(board("Affirm"), FACTS)).toEqual({ source: { module: "greenhouse", name: "Affirm", params: { slug: "affirm" }, target: "greenhouse:affirm", enabled: true } });
});

test("a new search that would pass the monthly budget at refresh_hours is refused", () => {
    const searches = ["a", "b", "c", "d", "e", "f"].map((query) => ({ name: query, query }));
    const facts = { ...FACTS, saved: savedSources({ searches }) };
    const search = { id: null, module: "jsearch", name: "g", values: { query: "g" } };
    expect(messages(saveSourcePlan(search, facts))).toEqual([[null, BUDGET]]);
    expect(saveSourcePlan(search, { ...facts, limits: { ...LIMITS, refresh_hours: 48 } })).toMatchObject({ source: { target: "jsearch:g|us|false" } });
    expect(messages(saveSourcePlan({ ...search, values: { query: "" } }, facts))).toEqual([["query", expect.any(String)]]);
});

test("turning a search on is refused when the searches that are on would pass the monthly budget at refresh_hours", () => {
    const searches = ["a", "b", "c", "d", "e", "f", "g"].map((query) => ({ name: query, query }));
    const saved = savedSources({ companies: [STRIPE_BOARD], searches }).map((source) => (source.name === "g" ? { ...source, enabled: false } : source));
    expect(enableProblem(saved, 8, LIMITS)).toBe(BUDGET);
    expect(enableProblem(saved, 8, { ...LIMITS, refresh_hours: 48 })).toBeNull();
    expect(
        enableProblem(
            saved.filter((source) => source.name !== "f"),
            8,
            LIMITS,
        ),
    ).toBeNull();
    const boardOff = saved.map((source) => (source.id === 1 ? { ...source, enabled: false } : source));
    expect(enableProblem(boardOff, 1, { ...LIMITS, monthly_request_cap: 1 })).toBeNull();
});
