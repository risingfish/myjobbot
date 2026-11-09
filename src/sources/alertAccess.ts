import type { SavedSource } from "../db/sourceStore.js";
import type { AlertDeps } from "../gmail/alertFetch.js";
import type { ToolContext } from "../tools/context.js";

type LookupContext = Pick<ToolContext, "config" | "sourcePlans" | "sources" | "jsearchApiKey" | "apiCalls" | "now">;
export type AlertAccessContext = LookupContext & Pick<ToolContext, "gmail" | "postings"> & { store: AlertDeps["known"] };
import { requestsThisMonth } from "../tools/searchBudget.js";
import { scheduledSearches } from "../web/sourceRules.js";

/** Gives the Gmail alerts module what reading alerts needs, through the run's checked client, once Gmail can be read; any other source gets nothing. */
export async function alertAccess(context: AlertAccessContext, saved: SavedSource): Promise<{ alerts?: AlertDeps }> {
    if (saved.module !== "gmail_alerts" || context.gmail.usable !== true) return {};
    const { gmail, config } = context;
    const reading = { gmail: gmail.store, alerts: gmail.alerts, known: context.store, postings: context.postings, key: gmail.key, imap: gmail.imap, senders: config.gmail.alert_senders, now: context.now(), source: { id: saved.id, name: saved.name } };
    return { alerts: { ...reading, lookup: await lookupDeps(context) } };
}

/** Gathers what the description lookups need: the JSearch key and settings, the job filters, and this month's budget left for every user's searches that are on. */
async function lookupDeps(context: LookupContext): Promise<AlertDeps["lookup"]> {
    const { config } = context;
    const filters = { titleFilter: config.title_filter, excludeCompanies: config.exclude_companies };
    const searches = scheduledSearches(await context.sourcePlans.sourcesOnForAll());
    return { http: context.sources, apiKey: context.jsearchApiKey, settings: config.jsearch, filters, searches, usedThisMonth: await requestsThisMonth(context) };
}
