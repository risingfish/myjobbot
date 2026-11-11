import type { RecentFetch } from "../db/fetchHistory.js";
import type { SavedSource, SourceOutcome } from "../db/sourceStore.js";
import { failingRepeatedly } from "../monitoring/failing.js";
import { moduleFor } from "../sources/registry.js";
import type { Met, Requirement } from "../sources/module.js";
import { localTime } from "./localTime.js";
import { paramValues, type SourceChoice, type SourceDraft } from "./sourceForm.js";

export interface SourceRowView {
    id: number;
    name: string;
    module: string;
    on: boolean;
    note: string | null;
    last: string | null;
    account: boolean;
    edit: SourceDraft | null;
    history: FetchLineView[];
    failing: boolean;
}

export interface FetchLineView {
    when: string;
    outcome: string;
    jobs: number;
}

export interface SourcesView {
    rows: SourceRowView[];
    usage: string;
    choices: SourceChoice[];
}

const ROW_NEEDS: Record<Requirement, string> = { jsearch_key: "needs JSEARCH_API_KEY in .env", gmail: "needs Gmail connected" };

const UNAVAILABLE = "unavailable";

const NEEDS_FIXING = "needs fixing";

const OUTCOME_TEXT: Record<SourceOutcome["outcome"] | "skipped", string> = { ok: "ok", partial: "stopped at the limit (continues next run)", failing: "failing", skipped: "skipped" };

/** Lists the owner's saved sources as the Settings page shows them: each one's module, whether it is on, its last fetch and recent ones, and what stops it being fetched, with Gmail alerts only once Gmail is connected. */
export function sourceRows(saved: SavedSource[], met: Met, recent = new Map<number, RecentFetch[]>()): SourceRowView[] {
    return saved.filter((source) => met.gmail || !isAccount(source)).map((source) => ({ ...sourceRow(source, met), ...historyOf(recent.get(source.id) ?? []) }));
}

/** Shows a source's recent fetches, newest first, and whether its latest 3 all failed. */
function historyOf(fetches: RecentFetch[]): Pick<SourceRowView, "history" | "failing"> {
    const history = fetches.map((fetch) => ({ when: localTime(fetch.at) ?? "", outcome: fetch.outcome === "failing" ? `failing: ${fetch.reason ?? "unexpected answer"}` : fetch.outcome === "skipped" ? `skipped: ${fetch.reason ?? ""}` : OUTCOME_TEXT[fetch.outcome], jobs: fetch.jobs }));
    return { history, failing: failingRepeatedly(fetches.map((fetch) => fetch.outcome)) };
}

/** Says how many JSearch requests this month has used out of the cap, for the line above the list. */
export function searchUsage(used: number, cap: number): string {
    return `JSearch requests this month: ${used} of ${cap}`;
}

/** Shows one saved source as a row, without its history. */
function sourceRow(source: SavedSource, met: Met): Omit<SourceRowView, "history" | "failing"> {
    const module = moduleFor(source.module)?.name ?? source.module;
    return { id: source.id, name: source.name, module, on: source.enabled, note: rowNote(source, met), last: lastFetch(source.last), account: isAccount(source), edit: editDraft(source) };
}

/** Gives the draft a source's Edit opens, or null for a source that can't be edited here: an account source, or one whose module is gone. */
function editDraft(source: SavedSource): SourceDraft | null {
    const module = moduleFor(source.module);
    if (module === null || module.scope === "account") return null;
    return { id: source.id, module: module.id, name: source.name, values: paramValues(module.fields, source.params) };
}

/** Reports whether a source belongs to the account, such as Gmail alerts, so it can only be switched on and off. */
function isAccount(source: SavedSource): boolean {
    return moduleFor(source.module)?.scope === "account";
}

/** Says what stops a source being fetched, or null when nothing does. */
function rowNote(source: SavedSource, met: Met): string | null {
    const found = moduleFor(source.module);
    if (found === null) return UNAVAILABLE;
    if (!found.params.safeParse(source.params).success) return NEEDS_FIXING;
    const unmet = found.requires.find((need) => !met[need]);
    return unmet === undefined ? null : ROW_NEEDS[unmet];
}

/** Describes a source's last fetch: when, how many jobs it read, and how it went, or null before its first fetch. */
function lastFetch(last: SourceOutcome | null): string | null {
    if (last === null) return null;
    const outcome = last.outcome === "failing" ? `failing: ${last.reason ?? "unexpected answer"}` : OUTCOME_TEXT[last.outcome];
    return `${localTime(last.at) ?? ""}: ${last.jobs} job${last.jobs === 1 ? "" : "s"}, ${outcome}`;
}
