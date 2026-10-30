import { expect, test } from "vitest";
import { enableProblem } from "../src/web/sourceRules.js";
import { savedSources, STRIPE_BOARD } from "./helpers/savedSources.js";

const BUDGET = "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours";

test("turning a search on is refused when the searches that are on would pass the monthly budget at refresh_hours", () => {
    const searches = ["a", "b", "c", "d", "e", "f", "g"].map((query) => ({ name: query, query }));
    const saved = savedSources({ companies: [STRIPE_BOARD], searches }).map((source) => (source.name === "g" ? { ...source, enabled: false } : source));
    const limits = { monthly_request_cap: 190, refresh_hours: 24 };
    expect(enableProblem(saved, 8, limits)).toBe(BUDGET);
    expect(enableProblem(saved, 8, { ...limits, refresh_hours: 48 })).toBeNull();
    expect(
        enableProblem(
            saved.filter((source) => source.name !== "f"),
            8,
            limits,
        ),
    ).toBeNull();
    const boardOff = saved.map((source) => (source.id === 1 ? { ...source, enabled: false } : source));
    expect(enableProblem(boardOff, 1, { ...limits, monthly_request_cap: 1 })).toBeNull();
});
