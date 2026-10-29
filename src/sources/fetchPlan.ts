import { REFRESH_GRACE_HOURS } from "../config/schema.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { Cursor, SourceModule } from "./module.js";
import { moduleFor } from "./registry.js";

export type SkipReason = "off" | "unknown module" | "invalid fields" | "not set up" | "not due" | "budget used";

export interface FetchFacts {
    now: Date;
    met: { jsearch_key: boolean; gmail: boolean };
    refreshHours: number;
    requestsLeft: number;
}

export type FetchPlan = { skip: SkipReason } | { module: SourceModule<unknown>; params: unknown; cursor: Cursor | null };

const SCOPE_ORDER: Record<string, number> = { company: 0, account: 1, query: 2 };

const ACCOUNT_MODULES: Record<string, string> = { gmail_alerts: "account" };

const MS_PER_HOUR = 3_600_000;

/** Orders saved sources the way a run fetches them: company sources, then account sources such as Gmail alerts, then searches, each in the order they were added. */
export function fetchOrder(saved: SavedSource[]): SavedSource[] {
    return [...saved].sort((left, right) => scopeRank(left) - scopeRank(right) || left.id - right.id);
}

/** Decides whether a run fetches a saved source and how, or why it skips it. */
export function fetchPlan(saved: SavedSource, facts: FetchFacts): FetchPlan {
    if (!saved.enabled) return { skip: "off" };
    const module = moduleFor(saved.module);
    if (module === null) return { skip: "unknown module" };
    const params = module.params.safeParse(saved.params);
    if (!params.success) return { skip: "invalid fields" };
    if (!module.requires.every((requirement) => facts.met[requirement])) return { skip: "not set up" };
    if (module.limits.refresh === "jsearch_refresh_hours" && !isDue(saved, facts)) return { skip: "not due" };
    if (module.requires.includes("jsearch_key") && facts.requestsLeft < 1) return { skip: "budget used" };
    return { module, params: params.data, cursor: cursorOf(saved.cursor) };
}

/** Reports whether a scheduled source's last fetch is at least its refresh interval old, less the leeway that keeps a daily schedule from slipping. */
function isDue(saved: SavedSource, facts: FetchFacts): boolean {
    if (saved.last === null) return true;
    const ageHours = (facts.now.getTime() - Date.parse(saved.last.at)) / MS_PER_HOUR;
    return ageHours >= facts.refreshHours - REFRESH_GRACE_HOURS;
}

/** Ranks a saved source by its module's scope, putting a module the app doesn't ship among the company sources. */
function scopeRank(saved: SavedSource): number {
    return SCOPE_ORDER[moduleFor(saved.module)?.scope ?? ACCOUNT_MODULES[saved.module] ?? "company"] ?? 0;
}

/** Reads a stored cursor as a place to continue from, or null to start from the first page. */
function cursorOf(stored: unknown): Cursor | null {
    return typeof stored === "object" && stored !== null && !Array.isArray(stored) ? (stored as Cursor) : null;
}
