import type { SavedSource } from "../db/sourceStore.js";
import type { AlertDeps } from "../gmail/alertFetch.js";
import type { ToolContext } from "../tools/context.js";
import { requestsThisMonth } from "../tools/searchBudget.js";
import { sourcesOn } from "../tools/sources.js";

/** Gives the Gmail alerts module what reading alerts needs, through the run's checked client, once Gmail can be read; any other source gets nothing. */
export async function alertAccess(context: ToolContext, saved: SavedSource): Promise<{ alerts?: AlertDeps }> {
    if (saved.module !== "gmail_alerts" || context.gmail.usable !== true) return {};
    const { gmail, config } = context;
    const reading = { gmail: gmail.store, alerts: gmail.alerts, known: context.store, key: gmail.key, imap: gmail.imap, senders: config.gmail.alert_senders, now: context.now(), source: { id: saved.id, name: saved.name } };
    return { alerts: { ...reading, lookup: await lookupDeps(context) } };
}

/** Gathers what the description lookups need: the JSearch key and settings, the job filters, and this month's budget left for the searches that are on. */
async function lookupDeps(context: ToolContext): Promise<AlertDeps["lookup"]> {
    const { config } = context;
    const filters = { titleFilter: config.title_filter, excludeCompanies: config.exclude_companies };
    const searches = sourcesOn(context).filter((source) => source.module === "jsearch").length;
    return { http: context.sources, apiKey: context.jsearchApiKey, settings: config.jsearch, filters, searches, usedThisMonth: await requestsThisMonth(context) };
}
