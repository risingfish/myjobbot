import type { JobSource } from "../db/jobSource.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { ToolContext } from "./context.js";

/** Lists the owner's saved sources that are on, the ones a run fetches and offers for scoring. */
export function sourcesOn(context: ToolContext): SavedSource[] {
    return context.saved.list.filter((saved) => saved.enabled);
}

/** Gives the saved source a source's jobs are stored and read under. */
export function sourceRef(source: Pick<SavedSource, "id" | "name">): JobSource {
    return { id: source.id, name: source.name };
}

/** Looks up a source that is on by name (case-insensitive), throwing if none matches. */
export function findSource(context: ToolContext, name: string): SavedSource {
    const wanted = name.trim().toLowerCase();
    const source = sourcesOn(context).find((candidate) => candidate.name.toLowerCase() === wanted);
    if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
    return source;
}
