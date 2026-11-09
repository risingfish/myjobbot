import { z } from "zod";
import { readAlerts, type AlertDeps, type AlertRead, type AlertSummary } from "../../gmail/alertFetch.js";
import { ALERTS_SOURCE } from "../../gmail/alertJobs/source.js";
import { ALERT_ATS } from "../../gmail/alertStore.js";
import { NotSetUp } from "../failure.js";
import type { SourceContext, SourceModule, SourcePage } from "../module.js";

export interface AlertSession {
    deps: AlertDeps;
    read: AlertRead | null;
    summary: AlertSummary | null;
}

export const gmailAlerts: SourceModule<object, AlertSession> = {
    id: "gmail_alerts",
    name: ALERTS_SOURCE,
    description: "LinkedIn job alert emails in the connected Gmail account.",
    kind: "email",
    jobAts: ALERT_ATS,
    descriptions: "careers_lookup",
    scope: "account",
    params: z.object({}),
    fields: [],
    requires: ["gmail"],
    limits: { maxJobsPerRun: null, refresh: "every_run", spends: "jsearch", skipWhenBudgetUsed: false },
    target: () => "gmail_alerts",
    fetch: (_params, ctx) => alertPages(ctx),
};

/** Yields the jobs from new alert emails as one page, costing the JSearch requests their description lookups made, leaving the read in the session for the run hook to record. */
async function* alertPages(ctx: SourceContext<AlertSession>): AsyncGenerator<SourcePage> {
    if (ctx.access === undefined) throw new NotSetUp("Gmail is not connected");
    const read = await readAlerts(ctx.access.deps);
    ctx.access.read = read;
    yield { jobs: read.jobs, cost: read.summary.searches, next: null };
}
