import type { SavedSource } from "../../db/sourceStore.js";
import { recordAlertRead } from "../../gmail/alertFetch.js";
import type { LookupDeps } from "../../gmail/alertLookupStep.js";
import { lookUpAlertJobs, type AlertLookupContext } from "../../tools/careersStep.js";
import type { SourceRun, ToolContext } from "../../tools/context.js";
import { requestsThisMonth } from "../../tools/searchBudget.js";
import { scheduledSearches } from "../../web/sourceRules.js";
import type { AlertSession } from "../modules/gmailAlerts.js";
import { alertSearch } from "../modules/jsearch.js";
import type { RunHook } from "../runHooks.js";

type SearchContext = Pick<ToolContext, "config" | "sourcePlans" | "sources" | "jsearchApiKey" | "apiCalls" | "now">;
type RecordContext = Pick<ToolContext, "store" | "gmail" | "trace" | "now">;
export type GmailAlertsContext = SearchContext & RecordContext & AlertLookupContext & Pick<ToolContext, "postings">;

export const gmailAlertsHook: RunHook<AlertSession | undefined, GmailAlertsContext> = { access, afterPage, afterFetch };

/** Opens the alert read for a run, through the run's checked client, once Gmail can be read, or gives none so the module reports Gmail as not set up. */
async function access(context: GmailAlertsContext, saved: SavedSource): Promise<AlertSession | undefined> {
    if (context.gmail.usable !== true) return undefined;
    const { gmail, config } = context;
    const reading = { gmail: gmail.store, alerts: gmail.alerts, known: context.store, postings: context.postings, key: gmail.key, imap: gmail.imap, senders: config.gmail.alert_senders, now: context.now(), source: { id: saved.id, name: saved.name } };
    return { deps: { ...reading, lookup: await lookupDeps(context) }, read: null, summary: null };
}

/** Records an alert page's read once its jobs are stored, and keeps its summary for the run. */
async function afterPage(context: RecordContext, _page: unknown, session: AlertSession | undefined): Promise<void> {
    if (session === undefined || session.read === null) return;
    await recordAlertRead({ jobStore: context.store, alerts: context.gmail.alerts, trace: context.trace, now: context.now() }, session.read);
    session.summary = session.read.summary;
    session.read = null;
}

/** Gives the run the alerts' summary and looks up careers pages for the alert jobs still lacking a description, once a page of alerts was read. */
async function afterFetch(context: AlertLookupContext, session: AlertSession | undefined): Promise<Partial<SourceRun>> {
    if (session === undefined || session.summary === null) return {};
    return { alerts: session.summary, careers: await lookUpAlertJobs(context) };
}

/** Gathers what the description lookups need: a JSearch search when the key is set, the job filters, and this month's budget left for every user's searches that are on. */
async function lookupDeps(context: SearchContext): Promise<LookupDeps> {
    const { config } = context;
    const filters = { titleFilter: config.title_filter, excludeCompanies: config.exclude_companies };
    const searches = scheduledSearches(await context.sourcePlans.sourcesOnForAll());
    const search = context.jsearchApiKey === null ? null : alertSearch(context.sources, { apiKey: context.jsearchApiKey, settings: config.jsearch });
    return { search, settings: config.jsearch, filters, searches, usedThisMonth: await requestsThisMonth(context) };
}
