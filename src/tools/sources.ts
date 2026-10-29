import type { CareersSummary } from "../careers/lookUpJobs.js";
import type { JobSource } from "../db/jobSource.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { AlertSummary } from "../gmail/alertFetch.js";
import { ATS_NAMES } from "../jobs/job.js";
import { savedSearch } from "../sources/modules/jsearch.js";
import { z } from "zod";
import type { ToolContext } from "./context.js";

const boardParams = z.object({ slug: z.string().min(1) });

interface SourceRef {
    id: number;
    name: string;
}

export type Company = SourceRef & { ats: (typeof ATS_NAMES)[number]; slug: string };
export type Search = SourceRef & z.infer<typeof savedSearch>;
export type Source = (SourceRef & { kind: "board"; company: Company }) | (SourceRef & { kind: "search"; search: Search }) | (SourceRef & { kind: "alerts" });

export interface FetchOutcome {
    seen: string | null;
    note: string | null;
    alerts?: AlertSummary;
    careers?: CareersSummary;
}

/** Lists the owner's saved sources that are on and that the run fetches through its tools: company boards, saved searches and Gmail alerts. */
export function configuredSources(context: ToolContext): Source[] {
    return context.saved.list.filter((saved) => saved.enabled).flatMap(toolSource);
}

/** Gives the saved source a source's jobs are stored and read under. */
export function sourceRef(source: SourceRef): JobSource {
    return { id: source.id, name: source.name };
}

/** Turns one saved source into the shape the tools fetch, or nothing for a module the tools can't fetch yet or fields that no longer pass. */
function toolSource(saved: SavedSource): Source[] {
    const ref = { id: saved.id, name: saved.name };
    if (saved.module === "gmail_alerts") return [{ ...ref, kind: "alerts" }];
    if (saved.module === "jsearch") {
        const search = savedSearch.safeParse(saved.params);
        return search.success ? [{ ...ref, kind: "search", search: { ...ref, ...search.data } }] : [];
    }
    const ats = ATS_NAMES.find((name) => name === saved.module);
    const board = boardParams.safeParse(saved.params);
    return ats !== undefined && board.success ? [{ ...ref, kind: "board", company: { ...ref, ats, slug: board.data.slug } }] : [];
}

/** Looks up a configured source by name (case-insensitive), throwing if none matches. */
export function findSource(context: ToolContext, name: string): Source {
    const wanted = name.trim().toLowerCase();
    const source = configuredSources(context).find((candidate) => candidate.name.toLowerCase() === wanted);
    if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
    return source;
}
