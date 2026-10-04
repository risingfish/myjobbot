import type { FileConfig } from "../config/schema.js";
import type { ToolContext } from "./context.js";

type Company = FileConfig["companies"][number];
export type Source = { kind: "board"; name: string; company: Company };

export function configuredSources(context: ToolContext): Source[] {
  return context.config.companies.map((company) => ({ kind: "board" as const, name: company.name, company }));
}

export function findSource(context: ToolContext, name: string): Source {
  const wanted = name.trim().toLowerCase();
  const source = configuredSources(context).find((candidate) => candidate.name.toLowerCase() === wanted);
  if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
  return source;
}
