import type { FileConfig } from "../config/schema.js";
import { ALERTS_SOURCE } from "../gmail/alertJobs/source.js";
import type { CareersSummary } from "../careers/lookUpJobs.js";
import type { AlertSummary } from "../gmail/alertFetch.js";
import type { ToolContext } from "./context.js";

export type Company = FileConfig["companies"][number];
export type Search = FileConfig["searches"][number];
export type Source = { kind: "board"; name: string; company: Company } | { kind: "search"; name: string; search: Search } | { kind: "alerts"; name: typeof ALERTS_SOURCE };

export interface FetchOutcome {
    seen: string | null;
    note: string | null;
    alerts?: AlertSummary;
    careers?: CareersSummary;
}

/** Lists every configured company board and saved search, plus the Gmail alerts source, as a uniform Source list. */
export function configuredSources(context: ToolContext): Source[] {
    const boards = context.config.companies.map((company) => ({ kind: "board" as const, name: company.name, company }));
    const searches = context.config.searches.map((search) => ({ kind: "search" as const, name: search.name, search }));
    return [...boards, ...searches, { kind: "alerts" as const, name: ALERTS_SOURCE }];
}

/** Looks up a configured source by name (case-insensitive), throwing if none matches. */
export function findSource(context: ToolContext, name: string): Source {
    const wanted = name.trim().toLowerCase();
    const source = configuredSources(context).find((candidate) => candidate.name.toLowerCase() === wanted);
    if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
    return source;
}
