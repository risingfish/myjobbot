import type { SavedSource, SourceOutcome } from "../db/sourceStore.js";
import { moduleFor } from "../sources/registry.js";
import { localTime } from "./gmailPanel.js";

export interface SourceRowView {
    id: number;
    name: string;
    module: string;
    on: boolean;
    note: string | null;
    last: string | null;
    account: boolean;
}

export interface SourcesView {
    rows: SourceRowView[];
    usage: string;
}

interface RowFacts {
    hasSearchKey: boolean;
    gmailConnected: boolean;
}

const NEEDS_SEARCH_KEY = "needs JSEARCH_API_KEY in .env";

const UNAVAILABLE = "unavailable";

const NEEDS_FIXING = "needs fixing";

const OUTCOME_TEXT: Record<SourceOutcome["outcome"], string> = { ok: "ok", partial: "stopped at the limit (continues next run)", failing: "failing" };

/** Lists the owner's saved sources as the Settings page shows them: each one's module, whether it is on, its last fetch, and what stops it being fetched, with Gmail alerts only once Gmail is connected. */
export function sourceRows(saved: SavedSource[], facts: RowFacts): SourceRowView[] {
    return saved.filter((source) => facts.gmailConnected || !isAccount(source)).map((source) => sourceRow(source, facts));
}

/** Says how many JSearch requests this month has used out of the cap, for the line above the list. */
export function searchUsage(used: number, cap: number): string {
    return `JSearch requests this month: ${used} of ${cap}`;
}

/** Shows one saved source as a row. */
function sourceRow(source: SavedSource, facts: RowFacts): SourceRowView {
    const module = moduleFor(source.module)?.name ?? source.module;
    return { id: source.id, name: source.name, module, on: source.enabled, note: rowNote(source, facts.hasSearchKey), last: lastFetch(source.last), account: isAccount(source) };
}

/** Reports whether a source belongs to the account, such as Gmail alerts, so it can only be switched on and off. */
function isAccount(source: SavedSource): boolean {
    return moduleFor(source.module)?.scope === "account";
}

/** Says what stops a source being fetched, or null when nothing does. */
function rowNote(source: SavedSource, hasSearchKey: boolean): string | null {
    const found = moduleFor(source.module);
    if (found === null) return UNAVAILABLE;
    if (!found.params.safeParse(source.params).success) return NEEDS_FIXING;
    return found.requires.includes("jsearch_key") && !hasSearchKey ? NEEDS_SEARCH_KEY : null;
}

/** Describes a source's last fetch: when, how many jobs it read, and how it went, or null before its first fetch. */
function lastFetch(last: SourceOutcome | null): string | null {
    if (last === null) return null;
    const outcome = last.outcome === "failing" ? `failing: ${last.reason ?? "unexpected answer"}` : OUTCOME_TEXT[last.outcome];
    return `${localTime(last.at) ?? ""}: ${last.jobs} job${last.jobs === 1 ? "" : "s"}, ${outcome}`;
}
