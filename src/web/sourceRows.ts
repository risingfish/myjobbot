import type { SavedSource } from "../db/sourceStore.js";
import { moduleFor } from "../sources/registry.js";

export interface SourceRowView {
    id: number;
    name: string;
    module: string;
    on: boolean;
    note: string | null;
}

const NEEDS_SEARCH_KEY = "needs JSEARCH_API_KEY in .env";

const UNAVAILABLE = "unavailable";

/** Lists the owner's saved sources as the Settings page shows them: each one's module, whether it is on, and what stops it being fetched. */
export function sourceRows(saved: SavedSource[], hasSearchKey: boolean): SourceRowView[] {
    return saved.map((source) => ({ id: source.id, name: source.name, module: moduleName(source.module), on: source.enabled, note: rowNote(source.module, hasSearchKey) }));
}

/** Names a source's module, falling back to its stored id for a module the app no longer ships. */
function moduleName(id: string): string {
    return moduleFor(id)?.name ?? id;
}

/** Says what stops a source being fetched, or null when nothing does. */
function rowNote(module: string, hasSearchKey: boolean): string | null {
    const found = moduleFor(module);
    if (found === null) return UNAVAILABLE;
    return found.requires.includes("jsearch_key") && !hasSearchKey ? NEEDS_SEARCH_KEY : null;
}
