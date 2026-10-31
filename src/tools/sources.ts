import type { JobSource } from "../db/jobSource.js";
import type { SavedSource } from "../db/sourceStore.js";
import { moduleFor } from "../sources/registry.js";
import type { ToolContext } from "./context.js";

/** Lists the owner's saved sources that are on, the ones a run fetches and offers for scoring; a source that reads Gmail is on only while Gmail is connected. */
export function sourcesOn(context: ToolContext): SavedSource[] {
    return context.saved.list.filter((saved) => saved.enabled && (context.gmail.connected || !readsGmail(saved)));
}

/** Reports whether a saved source's module reads the connected Gmail account. */
function readsGmail(saved: SavedSource): boolean {
    return moduleFor(saved.module)?.requires.includes("gmail") === true;
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
