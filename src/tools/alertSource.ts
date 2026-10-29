import { fetchAlerts, type AlertDeps, type AlertSummary, type LookupDeps } from "../gmail/alertFetch.js";
import type { CareersSummary } from "../careers/lookUpJobs.js";
import type { SavedSource } from "../db/sourceStore.js";
import { AlertsUnavailable } from "../gmail/alertJobs/usable.js";
import { lookUpAlertJobs } from "./careersStep.js";
import type { ToolContext } from "./context.js";
import { requestsThisMonth } from "./searchBudget.js";
import { sourceRef, sourcesOn } from "./sources.js";

/** Fetches the Gmail alerts source, then looks up careers pages for its jobs, refusing with its fixed note when Gmail can't be read. */
export async function alertSource(context: ToolContext, source: Pick<SavedSource, "id" | "name">): Promise<{ alerts: AlertSummary; careers: CareersSummary }> {
    if (context.gmail.usable !== true) throw new AlertsUnavailable(context.gmail.usable);
    const alerts = await fetchAlerts({ ...alertDeps(context), source: sourceRef(source), lookup: await lookupDeps(context) });
    return { alerts, careers: await lookUpAlertJobs(context) };
}

/** Gathers what the alert fetch needs from the run's context. */
function alertDeps(context: ToolContext): Omit<AlertDeps, "source"> {
    const { gmail } = context;
    return { gmail: gmail.store, alerts: gmail.alerts, store: context.store, key: gmail.key, imap: gmail.imap, senders: context.config.gmail.alert_senders, trace: context.trace, now: context.now() };
}

/** Gathers what the description lookups need, including this month's JSearch usage, so src/gmail never reads the tool context. */
async function lookupDeps(context: ToolContext): Promise<LookupDeps> {
    const { config } = context;
    const filters = { titleFilter: config.title_filter, excludeCompanies: config.exclude_companies };
    return { http: context.http, apiKey: context.jsearchApiKey, settings: config.jsearch, apiCalls: context.apiCalls, filters, searches: sourcesOn(context).filter((each) => each.module === "jsearch").length, usedThisMonth: await requestsThisMonth(context) };
}
