import { fetchAlerts, type AlertDeps } from "../gmail/alertFetch.js";
import { ALERTS_SOURCE } from "../gmail/alertJobs/source.js";
import { AlertsUnavailable } from "../gmail/alertJobs/usable.js";
import type { ToolContext } from "./context.js";
import type { FetchOutcome } from "./sources.js";

/** Fetches the Gmail alerts source once per run, refusing with its fixed note when Gmail can't be read. */
export async function alertSource(context: ToolContext): Promise<FetchOutcome> {
    if (context.gmail.usable !== true) throw new AlertsUnavailable(context.gmail.usable);
    const recorded = context.run.failedFetches.get(ALERTS_SOURCE);
    if (recorded) throw new AlertsUnavailable(recorded);
    const alerts = await fetchAlerts(alertDeps(context));
    return { seen: null, note: null, alerts };
}

/** Gathers what the alert fetch needs from the run's context. */
function alertDeps(context: ToolContext): AlertDeps {
    const { gmail } = context;
    return { gmail: gmail.store, alerts: gmail.alerts, store: context.store, key: gmail.key, imap: gmail.imap, senders: context.config.gmail.alert_senders, trace: context.trace, now: context.now() };
}
