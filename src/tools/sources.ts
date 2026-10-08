import type { FileConfig } from "../config/schema.js";
import type { ToolContext } from "./context.js";

export type Company = FileConfig["companies"][number];
export type Search = FileConfig["searches"][number];
export type Source = { kind: "board"; name: string; company: Company } | { kind: "search"; name: string; search: Search };

export interface FetchOutcome {
  seen: string | null;
  note: string | null;
}

/** Lists every configured company board and saved search as a uniform Source list. */
export function configuredSources(context: ToolContext): Source[] {
  const boards = context.config.companies.map((company) => ({ kind: "board" as const, name: company.name, company }));
  const searches = context.config.searches.map((search) => ({ kind: "search" as const, name: search.name, search }));
  return [...boards, ...searches];
}

/** Looks up a configured source by name (case-insensitive), throwing if none matches. */
export function findSource(context: ToolContext, name: string): Source {
  const wanted = name.trim().toLowerCase();
  const source = configuredSources(context).find((candidate) => candidate.name.toLowerCase() === wanted);
  if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
  return source;
}
