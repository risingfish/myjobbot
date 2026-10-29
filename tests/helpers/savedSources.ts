import type { SavedSource } from "../../src/db/sourceStore.js";
import { ALERTS_SOURCE } from "../../src/gmail/alertJobs/source.js";

interface Board {
    name: string;
    ats: string;
    slug: string;
}

interface Search {
    name: string;
    query: string;
    remote_only?: boolean;
    country?: string;
}

export interface SourceLists {
    companies?: Board[];
    searches?: Search[];
}

export const STRIPE_BOARD: Board = { name: "Stripe", ats: "greenhouse", slug: "stripe" };

function saved(id: number, source: Pick<SavedSource, "module" | "name" | "params" | "target">): SavedSource {
    return { ...source, id, enabled: true, companyId: null, cursor: null, last: null };
}

export function savedSources({ companies = [], searches = [] }: SourceLists, alerts = true): SavedSource[] {
    const boards = companies.map(({ name, ats, slug }) => ({ module: ats, name, params: { slug }, target: `${ats}:${slug}`.toLowerCase() }));
    const queries = searches.map(({ name, ...params }) => ({ module: "jsearch", name, params, target: `jsearch:${params.query}|${params.country ?? "us"}|${params.remote_only ?? false}`.toLowerCase() }));
    const account = alerts ? [{ module: "gmail_alerts", name: ALERTS_SOURCE, params: {}, target: "gmail_alerts" }] : [];
    return [...boards, ...queries, ...account].map((source, index) => saved(index + 1, source));
}
