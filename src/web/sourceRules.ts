import { REFRESH_GRACE_HOURS } from "../config/schema.js";
import type { SavedSource } from "../db/sourceStore.js";
import { moduleFor } from "../sources/registry.js";

export interface SearchLimits {
    monthly_request_cap: number;
    refresh_hours: number;
}

const HOURS_PER_MONTH = 30 * 24;

const OVER_BUDGET = "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours";

/** Says why a saved source can't be turned on, or null when it can: a scheduled search that would take JSearch past its monthly budget is refused. */
export function enableProblem(saved: SavedSource[], id: number, limits: SearchLimits): string | null {
    const source = saved.find((candidate) => candidate.id === id);
    if (source === undefined || source.enabled || !isScheduled(source)) return null;
    return fitsBudget(saved.filter((other) => other.enabled && isScheduled(other)).length + 1, limits) ? null : OVER_BUDGET;
}

/** Reports whether a source is fetched on JSearch's schedule, spending the monthly budget. */
function isScheduled(source: SavedSource): boolean {
    return moduleFor(source.module)?.limits.refresh === "jsearch_refresh_hours";
}

/** Reports whether this many scheduled searches, each fetched once per refresh interval, stay within the monthly request cap. */
function fitsBudget(searches: number, limits: SearchLimits): boolean {
    const refreshesPerMonth = Math.ceil(HOURS_PER_MONTH / (limits.refresh_hours - REFRESH_GRACE_HOURS));
    return searches * refreshesPerMonth <= limits.monthly_request_cap;
}
