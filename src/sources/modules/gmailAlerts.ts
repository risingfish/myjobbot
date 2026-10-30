import { z } from "zod";
import { readAlerts } from "../../gmail/alertFetch.js";
import { ALERTS_SOURCE } from "../../gmail/alertJobs/source.js";
import { NotSetUp } from "../failure.js";
import type { SourceContext, SourceModule, SourcePage } from "../module.js";

export const gmailAlerts: SourceModule<object> = {
    id: "gmail_alerts",
    name: ALERTS_SOURCE,
    description: "LinkedIn job alert emails in the connected Gmail account.",
    kind: "email",
    scope: "account",
    params: z.object({}),
    fields: [],
    requires: ["gmail"],
    limits: { maxJobsPerRun: null, refresh: "every_run" },
    target: () => "gmail_alerts",
    fetch: (_params, ctx) => alertPages(ctx),
};

/** Yields the jobs from new alert emails as one page, costing the JSearch requests their description lookups made, with the read for the fetch phase to record. */
async function* alertPages(ctx: SourceContext): AsyncGenerator<SourcePage> {
    if (ctx.alerts === undefined) throw new NotSetUp("Gmail is not connected");
    const read = await readAlerts(ctx.alerts);
    yield { jobs: read.jobs, cost: read.summary.searches, next: null, alerts: read };
}
