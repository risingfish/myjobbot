import type { JobSource } from "../db/jobSource.js";
import type { SavedSource } from "../db/sourceStore.js";
import { OFF_WHILE_UNMET, type Met } from "../sources/module.js";
import { moduleFor } from "../sources/registry.js";
import type { GmailAccess, SavedSources } from "./context.js";

export interface OnContext {
    saved: Pick<SavedSources, "list">;
    gmail: Pick<GmailAccess, "connected">;
}

/** Lists the owner's saved sources that are on, the ones a run fetches and offers for scoring; a source that reads Gmail is on only while Gmail is connected. */
export function sourcesOn(context: OnContext): SavedSource[] {
    // A missing JSearch key doesn't turn a source off: the fetch phase skips it as not set up.
    const met: Met = { gmail: context.gmail.connected, jsearch_key: true };
    return context.saved.list.filter((saved) => saved.enabled && !offWhileUnmet(saved, met));
}

/** Reports whether one of a saved source's needs that turn it off is unmet. */
function offWhileUnmet(saved: SavedSource, met: Met): boolean {
    return (moduleFor(saved.module)?.requires ?? []).some((need) => OFF_WHILE_UNMET[need] && !met[need]);
}

/** Gives the saved source a source's jobs are stored and read under. */
export function sourceRef(source: Pick<SavedSource, "id" | "name">): JobSource {
    return { id: source.id, name: source.name };
}

/** Looks up a source that is on by name (case-insensitive), throwing if none matches. */
export function findSource(context: OnContext, name: string): SavedSource {
    const wanted = name.trim().toLowerCase();
    const source = sourcesOn(context).find((candidate) => candidate.name.toLowerCase() === wanted);
    if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
    return source;
}
